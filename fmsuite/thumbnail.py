import os
import shutil
import zipfile
import subprocess
from lxml import etree
from flask import g, url_for
from PIL import Image, UnidentifiedImageError
from config import ABS_THEME_PATH, ABS_THUMB_PATH, THUMB_CREATION_TIMEOUT, THUMB_TYPES
from fmsuite import filesystem
from fmsuite import mediatypes


# XML namespaces for the EPUB format (these are used to avoid name conflicts in elements).
namespaces = {
        'u':"urn:oasis:names:tc:opendocument:xmlns:container",
        'xsi':"http://www.w3.org/2001/XMLSchema-instance",
        'opf':"http://www.idpf.org/2007/opf",
        'dcterms':"http://purl.org/dc/terms/",
        'calibre':"http://calibre.kovidgoyal.net/2009/metadata",
        'dc':"http://purl.org/dc/elements/1.1/",
        }


def create_image_thumbnail(img, target_size, out_thumb_path):
    ''' Make a thumbnail with target size by cropping out a maximal region from an image. '''
    if (target_size[0] / target_size[1]) > (img.size[0] / img.size[1]):
        # If image is too tall, crop some off from top and bottom
        scale_factor = target_size[0] / img.size[0] 
        height = int(target_size[1] / scale_factor)
        top = int((img.size[1] - height) / 2)
        img = img.crop((0, top, img.size[0], top + height))
    elif (target_size[0] / target_size[1]) < (img.size[0] / img.size[1]):
        # If image is too wide, crop some off from left and right
        scale_factor = target_size[1] / img.size[1] 
        width = int(target_size[0] / scale_factor)
        left = int((img.size[0] - width) / 2)
        img = img.crop((left, 0,  left + width, img.size[1]))
    # Resize cropped image
    thumb = img.resize(target_size, Image.ANTIALIAS)
    # Convert mode to RGB
    if thumb.mode in ("RGBA", "LA", "P"):
        new = Image.new("RGB", thumb.size, (255,255,255))
        new.paste(thumb)
        thumb = new
    # Save thumbnail
    thumb.save(out_thumb_path, "JPEG")


def make_thumbnail(in_file_path, uid, mtype, thumb_size, overwrite=False):
    ''' Make a thumbnail for a file. '''
    thumb_dir = ABS_THUMB_PATH + uid[:3] + "/"
    out_thumb_path = thumb_dir + uid + ".jpg"
    if not overwrite and os.path.exists(out_thumb_path):
        return
    # Create thumbnail directory if it doesn't exist
    if not os.path.isdir(thumb_dir):
         os.makedirs(thumb_dir)
    if mtype == "image":
        # Open image
        with Image.open(in_file_path) as im:
            # Create image thumbnail
            create_image_thumbnail(im, thumb_size, out_thumb_path)
    elif mtype == "video":
        # We use ffmpeg to create a thumbnail for the video files
        try:
            subprocess.run(["ffmpeg",
                            "-loglevel", "fatal",
                            "-i",  in_file_path,
                            "-ss", "120",
                            "-vframes", "1",
                            "-s", str(thumb_size[0]) + "x" + str(thumb_size[1]),
                            "-filter:v", "scale='min(" + str(thumb_size[0]) + "\,iw):-1'",
                            "-y", out_thumb_path],
                           timeout=THUMB_CREATION_TIMEOUT)
        except subprocess.TimeoutExpired:
            pass
    elif mtype == "pdf":
        # We use imagemagick to create a thumbnail for the pdf files
        try:
            subprocess.run(["convert", 
                            "-flatten",
                            "-density", "300",
                            "-resize", str(thumb_size[0]) + "x" + str(thumb_size[1]),
                            in_file_path + "[0]",  out_thumb_path], 
                           timeout=THUMB_CREATION_TIMEOUT)
        except subprocess.TimeoutExpired:
            pass
    elif mtype == "cbz":
        # Decompress first image from cbz archive
        with zipfile.ZipFile(in_file_path) as z:
            for member in sorted(z.namelist()):
                if member[-1] != "/":
                    with z.open(member) as zm:
                        with Image.open(zm) as im:
                            # Create image thumbnail
                            create_image_thumbnail(im, thumb_size, out_thumb_path)
                    break
    elif mtype == "epub":
        # Get EPUB cover image
        with zipfile.ZipFile(in_file_path) as z:
            t = etree.fromstring(z.read("META-INF/container.xml"))
            rootfile_path =  t.xpath("/u:container/u:rootfiles/u:rootfile",
                                     namespaces=namespaces)[0].get("full-path")
            t = etree.fromstring(z.read(rootfile_path))
            cover_id = t.xpath("//opf:metadata/opf:meta[@name='cover']",
                               namespaces=namespaces)[0].get("content")
            cover_href = t.xpath("//opf:manifest/opf:item[@id='" + cover_id + "']",
                                  namespaces=namespaces)[0].get("href")
            cover_path = os.path.join(os.path.dirname(rootfile_path), cover_href)
            with z.open(cover_path) as zm:
                with Image.open(zm) as im:
                    # Create image thumbnail
                    create_image_thumbnail(im, thumb_size, out_thumb_path)
    # If thumbnail creation failed, copy the image of a failed icon in its place.
    if not os.path.exists(out_thumb_path):
        shutil.copy(ABS_THEME_PATH + "thumb_failed.jpg", out_thumb_path)


def refresh_thumbnail(uid, thumb_size, thumbs_rq):
    ''' Refresh the thumbnail. '''
    path = g.DB.get(uid).decode()
    mtype = mediatypes.get_path_type(path)
    if mtype not in THUMB_TYPES:
        return -1
    else:
        # Enqueue a RQ job
        job = thumbs_rq.enqueue(make_thumbnail, path, uid, mtype,
                                thumb_size, True, failure_ttl=300)
        # Store the job ID -> Unique file ID association in the db
        g.DB.set(job.id, uid)
        return job.id
