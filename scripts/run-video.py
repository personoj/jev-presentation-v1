"""Run the installed oil-motion generator using a user-supplied credential file.
Only the selected provider secret is injected into the child environment.
"""
from pathlib import Path
import os,re,subprocess,sys
ROOT=Path(__file__).resolve().parents[1]
source=Path(os.environ.get('JEV_CREDENTIAL_FILE','C:/Users/W/Desktop/apikey.txt'))
key=None
for line in source.read_text(encoding='utf-8-sig').splitlines():
    parts=re.split(r'[:=：]',line,maxsplit=1)
    if len(parts)==2 and parts[0].strip().casefold()=='zenmux':
        key=parts[1].strip().strip('\"\'')
if not key:
    print('ZENMUX_CREDENTIAL_MISSING');sys.exit(2)
env=os.environ.copy();env['ZENMUX_API_KEY']=key;env['PYTHONIOENCODING']='utf-8'
env['PATH']=os.pathsep.join(['D:/conda/envs_dirs/codex/npm-global/node_modules/ffmpeg-static','D:/conda/envs_dirs/codex/npm-global/node_modules/ffprobe-static/bin/win32/x64',env.get('PATH','')])
script=ROOT.parent/'.agents/skills/oil-motion/scripts/video_job.py'
proc=subprocess.Popen([sys.executable,str(script),*sys.argv[1:]],env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf-8',errors='replace')
assert proc.stdout
for line in proc.stdout:
    print(line.replace(key,'[REDACTED]'),end='',flush=True)
sys.exit(proc.wait())
