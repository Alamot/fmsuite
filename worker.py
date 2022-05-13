#!/usr/bin/env python
import rq
import logging

# Preload libraries for the worker
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

# Logging setup
logger = logging.getLogger("rq.worker")
file_handler = logging.FileHandler("workers.log")
formatter = logging.Formatter("%(asctime)s | %(levelname)s | PID %(process)d | %(message)s")
file_handler.setFormatter(formatter)
logger.addHandler(file_handler)

# Provide queue names to listen to as arguments to this script,
# similar to rq worker
with rq.Connection():
    w = rq.Worker(["thumbs"])
    w.work()
