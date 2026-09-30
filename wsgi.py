import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from config.wsgi import application

app = application
