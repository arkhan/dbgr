# Stdlib:
import pathlib

PROJECT_DIR = pathlib.Path(__file__).parent
THEME = "indigo-red"
DBGR_TYPES = ("home", "pm", "shell", "debug")
UUID_REGEXP = (
    "[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}"
)
UNKNOWN_UUID = "UNKNOWN_UUID"
