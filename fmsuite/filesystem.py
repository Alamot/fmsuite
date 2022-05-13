import os
import hashlib
import mimetypes
from flask import g, url_for
from config import SHARES, SHOW_HIDDEN, REL_THEME_PATH, REL_THUMB_PATH, THUMB_SIZE, THUMB_TYPES
from fmsuite import mediatypes
from fmsuite import thumbnail


def get_path_uid(path):
    ''' Get a unique (but computable/deterministic) ID for a path. '''
    return hashlib.sha3_512(path.encode(), usedforsecurity=False).hexdigest()


def get_path_contents(path, thumbs_rq):
    ''' Returns the contents of a path (dirs, files). '''
    # If path == "/" return the SHARES instead.
    if path == "/":
        return [{"name": share, 
                 "path": share,
                 "stat": os.stat(share), 
                 "uid": get_path_uid(share), 
                 "thumb": url_for("static", filename=REL_THEME_PATH + "folder_" + 
                                  mediatypes.folder2type(share) + ".svg")} 
                for share in SHARES], []
    # We use os.scandir() to get the contents of a path
    dirs = []
    files = []
    contents = os.scandir(path)
    for c in contents:
        # Hide hidden files?
        if c.name.startswith('.') and not SHOW_HIDDEN:
            continue
        # File
        if c.is_file():
            f = {"name": c.name,
                 "path": c.path,
                 "mime": mimetypes.guess_type(c.path)[0],
                 "stat": c.stat(),
                 "uid": get_path_uid(c.path)}
            # Setup thumbnail
            mtype = mediatypes.mime2type(f["mime"])
            if thumbs_rq and (mtype in THUMB_TYPES):
                # Make a thumbnail, if possible (we enqueue a RQ job)
                job = thumbs_rq.enqueue(thumbnail.make_thumbnail, 
                                        c.path, f["uid"], mtype, THUMB_SIZE, False,
                                        failure_ttl=300)
                # Store the job ID -> Unique file ID association in the db
                g.DB.set(job.id, f["uid"])
                # Stote the URL path for our thumbnail
                f["thumb"] = url_for("static", filename=REL_THUMB_PATH + f["uid"][:3] +
                                                        "/" +  f["uid"] + ".jpg")
            else:
                # Otherwise, use the generic icon for the medium type
                f["thumb"] = url_for("static", filename=REL_THEME_PATH + "file_" +
                                                        mtype + ".svg")
            # Add file to the list of files
            files.append(f)
            # Associate the unique ID of the file with its path in the db.
            g.DB.set(f["uid"], f["path"])
        # Directory
        elif c.is_dir():
            d = {"name": c.name,
                 "path": c.path,
                 "stat": c.stat(),
                 "uid": get_path_uid(c.path),
                 "thumb": url_for("static", filename=REL_THEME_PATH +
                                  "folder_" + mediatypes.folder2type(c.path) + ".svg")}
            # Add directory to the list of directories
            dirs.append(d)
            # Associate the unique ID of the directory with its path in the db.
            g.DB.set(d["uid"], d["path"])
    # Sort the lists of dirs and files
    dirs.sort(key=lambda e: (e["name"].casefold(), e["name"]))
    files.sort(key=lambda e: (e["name"].casefold(), e["name"]))
    return dirs, files


def get_paths(path, limits=["/"]):
    ''' Get a list of tupples [(last folder, full path), ...] of all the paths included in
        a path. e.g.: If path is "/home/bob/" -> [("home", "/home"), ("bob", "/home/bob")]. 
    '''
    suppaths = []
    p = path.rstrip('/')
    while p:
        p, folder = p.rsplit('/', 1)
        fullpath = p + "/" + folder
        d = {"name": folder, "path": fullpath, "uid": get_path_uid(fullpath)}
        suppaths.append(d)
        g.DB.set(d["uid"], d["path"])
        if fullpath in limits:
            break
    return suppaths[::-1]


def get_tree_size(path):
    ''' Get total size of files in given path and subdirs. '''
    total = 0
    for entry in os.scandir(path):
        if entry.is_dir(follow_symlinks=False):
            total += get_tree_size(entry.path)
        else:
            total += entry.stat(follow_symlinks=False).st_size
    return total


def prepare_uids_recursively(dir_path):
    '''  Prepare unique IDs for all the shared dirs and files.
         All access is done through those unique IDs.
         (thus, we avoid path traversal and many other types of attacks). 
    '''
    # Set a unique ID for this path (it's a directory) in the db
    g.DB.set(get_path_uid(dir_path), dir_path)
    # We use os.scandir() to get the contents of a directory
    contents = os.scandir(dir_path)
    for c in contents:
        if not SHOW_HIDDEN and c.name.startswith('.'):
            # Hide hidden files
            continue
        if c.is_dir(): 
            # Directory
            prepare_uids_recursively(c.path)
        else:          
            # File: Get a unique ID for this
            uid = get_path_uid(c.path)
            # Set the unique ID for this file path in the db.
            g.DB.set(uid, c.path)
