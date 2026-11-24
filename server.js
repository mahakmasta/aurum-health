const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify({users:[], sessions:{}, records:[], tasks:[], insurance:[], reminders:[], family:[], appointments:[], prep:[], medicationLogs:[]}, null, 2));

const readDB = () => { const db=JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); db.users ||= []; db.sessions ||= {}; db.records ||= []; db.tasks ||= []; db.insurance ||= []; db.reminders ||= []; db.family ||= []; db.appointments ||= []; db.prep ||= []; db.medicationLogs ||= []; return db; };
const writeDB = db => fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
const send = (res, status, data, headers={}) => { res.writeHead(status, {'Content-Type':'application/json; charset=utf-8', ...headers}); res.end(JSON.stringify(data)); };
const parseCookies = s => Object.fromEntries((s||'').split(';').map(v=>v.trim().split('=').map(decodeURIComponent)).filter(a=>a.length===2));
const getUser = (req, db) => { const sid=parseCookies(req.headers.cookie).aurum_session; const uid=db.sessions[sid]; return db.users.find(u=>u.id===uid); };
const body = req => new Promise((resolve,reject)=>{let s='';req.on('data',c=>{s+=c;if(s.length>9*1024*1024) reject(new Error('Request too large; maximum upload size is 6 MB.'));});req.on('end',()=>{try{resolve(s?JSON.parse(s):{});}catch(e){reject(e);}});});
const hash = (password,salt=crypto.randomBytes(16).toString('hex')) => ({salt,hash:crypto.scryptSync(password,salt,64).toString('hex')});
const safeUser = u => ({id:u.id,name:u.name,email:u.email,phone:u.phone||'',dob:u.dob||''});
const saveUpload = b => { if(!b.fileData) return null; const data=Buffer.from(String(b.fileData),'base64'); if(data.length>6*1024*1024) throw new Error('File must be 6 MB or smaller.'); const ext=path.extname(String(b.fileName||'')).slice(0,12).replace(/[^.a-zA-Z0-9]/g,''); const id=crypto.randomUUID(); const stored=id+ext; fs.writeFileSync(path.join(UPLOAD_DIR,stored),data); return {fileId:id,storedName:stored,fileName:String(b.fileName||'document').slice(0,180),mimeType:String(b.mimeType||'application/octet-stream').slice(0,100)}; };

async function api(req,res,url) {
  const db=readDB();
  if(req.method==='GET' && url.pathname==='/api/health') return send(res,200,{ok:true,app:'Aurum Health'});
  if(req.method==='POST' && ['/api/register','/api/login'].includes(url.pathname)){
    const b=await body(req); const email=String(b.email||'').trim().toLowerCase(); const password=String(b.password||'');
    if(!email || password.length<4) return send(res,400,{error:'Enter a valid email and a password of at least 4 characters.'});
    let user=db.users.find(u=>u.email===email);
    if(url.pathname==='/api/register'){
      if(user) return send(res,409,{error:'An account with this email already exists.'});
      const p=hash(password); user={id:crypto.randomUUID(),name:String(b.name||email.split('@')[0]),email,...p,phone:'',dob:''}; db.users.push(user);
    } else {
      if(!user) return send(res,401,{error:'Account not found. Please register first.'});
      const check=crypto.scryptSync(password,user.salt,64).toString('hex');
      if(check!==user.hash) return send(res,401,{error:'Incorrect password.'});
    }
    const sid=crypto.randomBytes(24).toString('hex'); db.sessions[sid]=user.id; writeDB(db);
    return send(res,200,{user:safeUser(user)},{'Set-Cookie':`aurum_session=${encodeURIComponent(sid)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800`});
  }
  const user=getUser(req,db);
  if(url.pathname==='/api/logout' && req.method==='POST'){
    const sid=parseCookies(req.headers.cookie).aurum_session; delete db.sessions[sid]; writeDB(db);
    return send(res,200,{ok:true},{'Set-Cookie':'aurum_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0'});
  }
  if(url.pathname==='/api/me' && req.method==='GET') return user?send(res,200,{user:safeUser(user)}):send(res,401,{error:'Not logged in'});
  if(!user) return send(res,401,{error:'Please log in to continue.'});
  if(url.pathname==='/api/profile' && req.method==='PUT'){
    const b=await body(req); Object.assign(user,{name:String(b.name||user.name),phone:String(b.phone||''),dob:String(b.dob||'')}); writeDB(db); return send(res,200,{user:safeUser(user)});
  }
  if(url.pathname==='/api/password' && req.method==='POST'){
    const b=await body(req); const current=String(b.currentPassword||''), next=String(b.newPassword||'');
    if(next.length<4) return send(res,400,{error:'New password must contain at least 4 characters.'});
    const check=crypto.scryptSync(current,user.salt,64).toString('hex');
    if(check!==user.hash) return send(res,400,{error:'Current password is incorrect.'});
    const p=hash(next); user.salt=p.salt; user.hash=p.hash; writeDB(db); return send(res,200,{ok:true});
  }
  if(url.pathname==='/api/records' && req.method==='GET') return send(res,200,{records:db.records.filter(r=>r.userId===user.id)});
  if(url.pathname==='/api/records' && req.method==='POST'){
    const b=await body(req); const upload=saveUpload(b); if(!upload)return send(res,400,{error:'Please attach a file.'}); const r={id:crypto.randomUUID(),userId:user.id,title:String(b.title||upload.fileName).slice(0,100),category:String(b.category||'Document').slice(0,60),date:new Date().toISOString().slice(0,10),...upload}; db.records.unshift(r); writeDB(db); return send(res,201,{record:r});
  }
  if(url.pathname==='/api/insurance' && req.method==='GET') return send(res,200,{insurance:db.insurance.find(x=>x.userId===user.id)||null});
  if(url.pathname==='/api/insurance' && req.method==='POST'){
    const b=await body(req); const prior=db.insurance.find(x=>x.userId===user.id); const upload=saveUpload(b);
    const item={userId:user.id,provider:String(b.provider||'').slice(0,100),policyNumber:String(b.policyNumber||'').slice(0,100),memberId:String(b.memberId||'').slice(0,100),validTill:String(b.validTill||'').slice(0,20),...(upload||((prior&&prior.fileId)?{fileId:prior.fileId,storedName:prior.storedName,fileName:prior.fileName,mimeType:prior.mimeType}:{}))};
    if(!item.provider||!item.policyNumber)return send(res,400,{error:'Provider and policy number are required.'});
    if(prior) Object.assign(prior,item); else db.insurance.push(item); writeDB(db); return send(res,200,{insurance:item});
  }
  if(url.pathname.startsWith('/api/files/') && req.method==='GET'){
    const id=decodeURIComponent(url.pathname.split('/').pop());
    const item=db.records.find(r=>r.userId===user.id&&r.fileId===id)||db.insurance.find(r=>r.userId===user.id&&r.fileId===id);
    if(!item)return send(res,404,{error:'File not found'});
    const stored=item.storedName; const target=stored&&path.join(UPLOAD_DIR,path.basename(stored));
    if(!target||!fs.existsSync(target))return send(res,404,{error:'File is no longer available'});
    res.writeHead(200,{'Content-Type':item.mimeType||'application/octet-stream','Content-Disposition':`inline; filename*=UTF-8''${encodeURIComponent(item.fileName||'document')}`,'X-Content-Type-Options':'nosniff'}); return fs.createReadStream(target).pipe(res);
  }
  if(url.pathname.startsWith('/api/records/') && req.method==='DELETE'){
    const id=url.pathname.split('/').pop(); const removed=db.records.find(r=>r.id===id&&r.userId===user.id); if(removed&&removed.storedName){try{fs.unlinkSync(path.join(UPLOAD_DIR,path.basename(removed.storedName)));}catch(e){}} db.records=db.records.filter(r=>!(r.id===id&&r.userId===user.id)); writeDB(db); return send(res,200,{ok:true});
  }
  // Medication dose log (per account and calendar day)
  if(url.pathname==='/api/medication-log' && req.method==='GET') {
    const day=String(url.searchParams.get('day')||new Date().toISOString().slice(0,10));
    return send(res,200,{logs:db.medicationLogs.filter(x=>x.userId===user.id&&x.day===day)});
  }
  if(url.pathname==='/api/medication-log' && req.method==='POST') {
    const b=await body(req); if(!b.medicine) return send(res,400,{error:'Medicine name is required.'});
    const day=String(b.day||new Date().toISOString().slice(0,10));
    const existing=db.medicationLogs.find(x=>x.userId===user.id&&x.day===day&&x.medicine===String(b.medicine));
    if(existing){existing.taken=!!b.taken;existing.takenAt=b.taken?new Date().toISOString():null;}
    else db.medicationLogs.push({id:crypto.randomUUID(),userId:user.id,day,medicine:String(b.medicine).slice(0,120),taken:!!b.taken,takenAt:b.taken?new Date().toISOString():null});
    writeDB(db); return send(res,200,{ok:true});
  }
  // Personal reminders, appointments, family vault and consultation checklist
  if(url.pathname==='/api/reminders' && req.method==='GET') return send(res,200,{reminders:db.reminders.filter(x=>x.userId===user.id)});
  if(url.pathname==='/api/reminders' && req.method==='POST'){
    const b=await body(req); if(!b.title||!b.dueAt)return send(res,400,{error:'Reminder title and date/time are required.'});
    const x={id:crypto.randomUUID(),userId:user.id,title:String(b.title).slice(0,120),dueAt:String(b.dueAt),priority:String(b.priority||'Routine'),done:false,createdAt:new Date().toISOString()}; db.reminders.unshift(x); writeDB(db); return send(res,201,{reminder:x});
  }
  if(url.pathname.startsWith('/api/reminders/') && req.method==='PATCH'){
    const id=url.pathname.split('/').pop(), b=await body(req), x=db.reminders.find(x=>x.id===id&&x.userId===user.id); if(!x)return send(res,404,{error:'Reminder not found'}); if('done' in b)x.done=!!b.done; writeDB(db); return send(res,200,{reminder:x});
  }
  if(url.pathname.startsWith('/api/reminders/') && req.method==='DELETE') { const id=url.pathname.split('/').pop(); db.reminders=db.reminders.filter(x=>!(x.id===id&&x.userId===user.id)); writeDB(db); return send(res,200,{ok:true}); }
  if(url.pathname==='/api/appointments' && req.method==='GET') return send(res,200,{appointments:db.appointments.filter(x=>x.userId===user.id)});
  if(url.pathname==='/api/appointments' && req.method==='POST'){
    const b=await body(req); if(!b.doctor||!b.dateTime)return send(res,400,{error:'Doctor and appointment date/time are required.'});
    const x={id:crypto.randomUUID(),userId:user.id,doctor:String(b.doctor).slice(0,120),specialty:String(b.specialty||'').slice(0,80),clinic:String(b.clinic||'').slice(0,120),dateTime:String(b.dateTime),createdAt:new Date().toISOString()}; db.appointments.unshift(x); writeDB(db); return send(res,201,{appointment:x});
  }
  if(url.pathname.startsWith('/api/appointments/') && req.method==='DELETE') { const id=url.pathname.split('/').pop(); db.appointments=db.appointments.filter(x=>!(x.id===id&&x.userId===user.id)); writeDB(db); return send(res,200,{ok:true}); }
  if(url.pathname==='/api/family' && req.method==='GET') return send(res,200,{members:db.family.filter(x=>x.userId===user.id)});
  if(url.pathname==='/api/family' && req.method==='POST'){
    const b=await body(req); if(!b.name||!b.relationship)return send(res,400,{error:'Name and relationship are required.'});
    const x={id:crypto.randomUUID(),userId:user.id,name:String(b.name).slice(0,100),relationship:String(b.relationship).slice(0,60),dob:String(b.dob||''),phone:String(b.phone||'').slice(0,30),createdAt:new Date().toISOString()}; db.family.push(x); writeDB(db); return send(res,201,{member:x});
  }
  if(url.pathname.startsWith('/api/family/') && req.method==='DELETE') { const id=url.pathname.split('/').pop(); db.family=db.family.filter(x=>!(x.id===id&&x.userId===user.id)); writeDB(db); return send(res,200,{ok:true}); }
  if(url.pathname==='/api/prep' && req.method==='GET') return send(res,200,{items:db.prep.filter(x=>x.userId===user.id)});
  if(url.pathname==='/api/prep' && req.method==='POST'){
    const b=await body(req); const items=Array.isArray(b.items)?b.items.slice(0,40):[]; db.prep=db.prep.filter(x=>x.userId!==user.id); items.forEach((x,i)=>db.prep.push({userId:user.id,key:String(x.key||i),label:String(x.label||'').slice(0,180),done:!!x.done})); writeDB(db); return send(res,200,{ok:true});
  }
  if(url.pathname==='/api/tasks' && req.method==='GET') return send(res,200,{tasks:db.tasks.filter(t=>t.userId===user.id)});
  if(url.pathname==='/api/tasks' && req.method==='POST'){
    const b=await body(req); const t={id:crypto.randomUUID(),userId:user.id,title:String(b.title||'Health task'),done:false}; db.tasks.unshift(t); writeDB(db); return send(res,201,{task:t});
  }
  if(url.pathname.startsWith('/api/tasks/') && req.method==='PATCH'){
    const id=url.pathname.split('/').pop(); const b=await body(req); const t=db.tasks.find(t=>t.id===id&&t.userId===user.id); if(!t)return send(res,404,{error:'Task not found'}); t.done=!!b.done; writeDB(db); return send(res,200,{task:t});
  }
  return send(res,404,{error:'API route not found'});
}
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.json':'application/json'};
http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname.startsWith('/api/')) { try{return await api(req,res,url);}catch(e){return send(res,400,{error:e.message||'Request failed'});} }
  let file=path.join(ROOT,decodeURIComponent(url.pathname));
  if(url.pathname==='/') file=path.join(ROOT,'index.html');
  if(!file.startsWith(ROOT)){res.writeHead(403);return res.end('Forbidden');}
  if(fs.existsSync(file)&&fs.statSync(file).isDirectory()) file=path.join(file,'index.html');
  if(!fs.existsSync(file)){res.writeHead(404);return res.end('Not found');}
  res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});
  fs.createReadStream(file).pipe(res);
}).listen(PORT,()=>console.log(`Aurum Health running at http://localhost:${PORT}`));
