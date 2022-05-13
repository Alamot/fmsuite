# Enable/Disable Debugging
DEBUG = False

# What paths to show in our Web File Browser
SHARES = ["/mnt/MEDIA/COMICS", "/mnt/MEDIA/IMAGES"]

# Show hidden (.dot) files?
SHOW_HIDDEN = False

# Absolute static path
ABS_STATIC_PATH = "/var/www/fmsuite/fmsuite/static/"

# Theme config
THEME = "red"
REL_THEME_PATH = "img/themes/" + THEME + "/"
ABS_THEME_PATH = ABS_STATIC_PATH + REL_THEME_PATH

# Thumbnails config
THUMBNAILS = True
THUMB_SIZE = (128, 128)
THUMB_CREATION_TIMEOUT = 30
REL_THUMB_PATH = "img/thumbs/"
ABS_THUMB_PATH = ABS_STATIC_PATH + REL_THUMB_PATH
THUMB_TYPES = ["image", "video", "pdf", "epub", "cbz"]

# Create a secret key (in order to use sessions)
import secrets
SECRET_KEY = secrets.token_hex()
