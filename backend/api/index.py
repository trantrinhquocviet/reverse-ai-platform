import sys
import os

# Add backend/ to sys.path so `from app.main import app` resolves correctly
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.main import app  # noqa: F401
