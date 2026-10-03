# futures_levels/py/main.py
from futures_levels.py.api import app

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
