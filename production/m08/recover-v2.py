"""Recover an already submitted job; this script never submits a new generation."""
from pathlib import Path
import os,re,sys,time,json,importlib,urllib.error
FOLDER=Path(__file__).resolve().parent;ROOT=FOLDER.parents[1]
sys.path.insert(0,str(ROOT.parent/'.agents/skills/oil-motion/scripts'))
video_job=importlib.import_module('video_job')
source=Path(os.environ.get('JEV_CREDENTIAL_FILE','C:/Users/W/Desktop/apikey.txt'))
key=None
for line in source.read_text(encoding='utf-8-sig').splitlines():
    parts=re.split(r'[:=：]',line,maxsplit=1)
    if len(parts)==2 and parts[0].strip().casefold()=='zenmux':key=parts[1].strip().strip('\"\'')
if not key:raise SystemExit('ZENMUX_CREDENTIAL_MISSING')
job='4e8281f78b194a79905620d5f72163b2'
def recover():
    errors=0
    for attempt in range(60):
        try:response=video_job.request_json('GET',f'{video_job.API_ROOT}/videos/{job}',key)
        except urllib.error.URLError:
            errors+=1
            if errors>=3:raise
            print('Transient GET connection failure; rechecking same job.',flush=True);time.sleep(5);continue
        status=video_job.find_status(response);print('Existing job status:',status,flush=True)
        if status not in video_job.TERMINAL_STATES:time.sleep(5);continue
        (FOLDER/'job-v2.json').write_text(json.dumps({'recoveredExistingJob':job,'final':response},ensure_ascii=False,indent=2),encoding='utf8')
        if status!='succeeded':raise RuntimeError('Existing generation ended in '+status)
        url=video_job.walk_for_url(response,('video_url','videoUrl','url','download_url'))
        if not url:raise RuntimeError('No downloadable result')
        video_job.download(url,FOLDER/'master-v2.mp4')
        print('Recovered master-v2.mp4 without another submission.',flush=True)
        return
    raise TimeoutError('Existing job still pending after bounded recovery')
try:recover()
except Exception as exc:
    print(str(exc).replace(key,'[REDACTED]'),file=sys.stderr);raise SystemExit(1)
