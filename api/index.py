import sys
import os

# Add the project root directory to sys.path so Python can find 'config'
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.wsgi import application

app = application
