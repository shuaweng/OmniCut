#!/bin/sh
set -eu
TASK_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
uv venv "$TASK_ROOT/.opencv-python" --python 3.12 --allow-existing
uv pip install --python "$TASK_ROOT/.opencv-python/bin/python" 'opencv-python-headless>=4.10,<5' 'numpy>=2.1,<3'
