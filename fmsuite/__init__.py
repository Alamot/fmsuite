import rq
import uuid
import redis
import logging
import mimetypes
from flask import Flask, g, jsonify, render_template, request, send_file, session
from flask_talisman import Talisman
from fmsuite import filesystem
from fmsuite import thumbnail
from config import SHARES, THUMBNAILS, THUMB_SIZE


def generate_csrf_token():
    ''' Generate a unique token in order to prevent
        CSRF (Cross-Site Request Forgery) attacks. '''
    if "_csrf_token" not in session:
        session["_csrf_token"] = str(uuid.uuid4())
    return session["_csrf_token"]


def get_db():
    ''' Get a Redis db connection '''
    # g is a namespace object/proxy that store data during an application context/request.
    db = getattr(g, 'DB', None)
    if db is None:
        g.DB = redis.Redis(host="localhost", port=6379, db=0)
    # If thumbnails are enabled, setup a RQ queue for the jobs
    if THUMBNAILS:
        g.RQ_THUMBS = rq.Queue("thumbs", connection=g.DB)
    else:
        g.RQ_THUMBS = None
    return g.DB


# Init Flask app
app = Flask(__name__, static_folder='static', static_url_path='')
app.config.from_pyfile('../config.py')
app.jinja_env.globals['csrf_token'] = generate_csrf_token
log = logging.getLogger('werkzeug')
log.setLevel(logging.WARNING)


# Content Security Policy for Flask-Talisman
csp = {"default-src": ["'self'", "blob:", "data:"],
       "script-src": ["'self'",
                      "'sha256-2pWe29RAjmUSi77PP/nCW8IcD9XnGs0VJaq+dLPBlzg='" # For Readium
                     ],
       "style-src": ["'self'", "blob:", "'unsafe-inline'"]}

talisman = Talisman(app,
    content_security_policy=csp,
    content_security_policy_nonce_in=["script-src"]
)


@app.before_first_request
def initialization():
    ''' Run only once, before the first request. '''
    # Get a Redis db connection
    get_db()
    # Prepare unique IDs for all the shared dirs and files. All access is done through
    # those unique IDs (thus, we avoid path traversal and many other types of attacks).
    log.warn("Preparing unique IDs for all the shared dirs and files. Please wait...")
    for share in SHARES:
        filesystem.prepare_uids_recursively(share)
    log.warn("READY")


@app.before_request
def _init():
    ''' Run before each request '''
    # Get "view" setting value from cookie (or use value "#gallery-view" as default).
    g.VIEW = request.cookies.get("view") or "#gallery-view"
    # Get a Redis db connection.
    get_db()


@app.route("/")
def index():
    ''' View function for / '''
    dirs, files = filesystem.get_path_contents("/", g.RQ_THUMBS)
    return render_template("folder.html",
                           paths=filesystem.get_paths("/", limits=SHARES),
                           dirs=dirs, files=files)


@app.route("/epub_reader/")
def epub_reader():
    ''' View function for /epub_reader '''
    return render_template("epub_reader.html")


@app.route("/explore/<uid>/")
def explore_path(uid):
    ''' View function for /explore/<uid>/ '''
    path = g.DB.get(uid).decode()
    dirs, files = filesystem.get_path_contents(path, g.RQ_THUMBS)
    return render_template("folder.html",
                           paths=filesystem.get_paths(path, limits=SHARES),
                           dirs=dirs, files=files)


@app.route("/serve/<uid>/")
def serve_file(uid):
    ''' Serve file. '''
    path = g.DB.get(uid).decode()
    mimetype = mimetypes.guess_type(path)[0]
    return send_file(path, mimetype=mimetype, conditional=True)


@app.route("/get/<uid>/")
def get_file(uid):
    ''' Get (i.e. download) file. '''
    path = g.DB.get(uid).decode()
    mimetype = mimetypes.guess_type(path)[0]
    return send_file(path, mimetype=mimetype, as_attachment=True)


@app.route("/job/failed/")
def get_failed_thumbs():
    ''' Get failed thumbnail jobs. '''
    if not g.RQ_THUMBS:
        return jsonify([])
    reg = g.RQ_THUMBS.failed_job_registry
    job_ids = reg.get_job_ids()
    if not job_ids:
        return jsonify([])
    thumb_ids = [g.DB.get(job_id).decode() for job_id in job_ids]
    # Clean failed jobs
    for job_id in job_ids:
        reg.remove(job_id, delete_job=True)
    return jsonify(thumb_ids)


@app.route("/job/finished/")
def get_finished_thumbs():
    ''' Get finished thumbnail jobs. '''
    if not g.RQ_THUMBS:
        return jsonify([])
    job_ids = g.RQ_THUMBS.finished_job_registry.get_job_ids()
    if not job_ids:
        if not g.RQ_THUMBS.scheduled_job_registry.get_job_ids():
            if not g.RQ_THUMBS.started_job_registry.get_job_ids():
                return jsonify("empty")
        return jsonify([])
    thumb_ids = [g.DB.get(job_id).decode() for job_id in job_ids]
    # Clean finished jobs
    for job_id in job_ids:
        g.RQ_THUMBS.finished_job_registry.remove(job_id, delete_job=True)
    return jsonify(thumb_ids)


@app.route("/refresh/<uid>/", methods=["POST"])
def refresh_path(uid):
    ''' Refresh thumbnail. '''
    if not g.RQ_THUMBS:
        return jsonify(-1)
    jobid = thumbnail.refresh_thumbnail(uid, THUMB_SIZE, g.RQ_THUMBS)
    return jsonify(jobid)


@app.template_filter("mime2type")
def jinja_mime2type(s):
    ''' Jinja2 filter to get the media type from a MIME type. '''
    return filesystem.mime2type(s)
