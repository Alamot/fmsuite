import mimetypes


def mime2type(mime):
    ''' Try to guess the medium type from a MIME type. '''
    if not mime:
        return "none"
    if "comicbook+zip" in mime:
        return "cbz"
    for m in ["image", "audio", "video", "pdf", "epub", "html",
              "word", "gzip", "tar", "rar", "zip"]:
        if m in mime:
            return m
    return "none"


def folder2type(path):
    ''' For the time being, we try to guess the type of a folder from
        its name/path. A more appropriate solution would be to guess it
        based on what type is the majority of its contents.
    '''
    n = path.lower()
    if not n:
        return "none"
    if any(s in n for s in ["audio", "album", "music"]):
        return "audio"
    if any(s in n for s in ["book", "comic", "magazine"]):
        return "book"
    if any(s in n for s in ["image", "picture", "photo", "thumbn"]):
        return "image"
    if any(s in n for s in ["film", "movie", "video", "series"]):
        return "video"
    return "none"


def get_path_type(path):
    ''' Try to guess the file type based on its MIME type. '''
    mime = mimetypes.guess_type(path)[0]
    return mime2type(mime)
