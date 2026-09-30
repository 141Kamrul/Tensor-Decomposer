import os
import sys

# Add both current working directory and parent directory to sys.path
root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
cwd = os.getcwd()

for p in (root_dir, cwd):
    if p not in sys.path:
        sys.path.insert(0, p)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

try:
    from config.wsgi import application
    app = application
    handler = application
except Exception as e:
    import traceback
    traceback.print_exc()
    raise e
