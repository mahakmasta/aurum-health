/* Aurum Health interactions. Keeps the supplied screen layouts intact. */
(() => {
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];
  const api = async (url, opts={}) => {
    const response = await fetch(url, {
      credentials: 'same-origin',
      headers: {'Content-Type':'application/json', ...(opts.headers||{})},
      ...opts
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
    return data;
  };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const toast = (message) => {
    let node = $('#aurumNotice');
    if (!node) {
      node = document.createElement('div'); node.id = 'aurumNotice';
      node.style.cssText = 'position:fixed;z-index:99999;bottom:22px;left:50%;transform:translateX(-50%);background:#174d3a;color:#fff;padding:12px 18px;border-radius:12px;box-shadow:0 8px 28px #0003;font:14px Arial;max-width:90%;';
      document.body.append(node);
    }
    node.textContent = message; node.style.display = 'block';
    clearTimeout(window.__aurumNoticeTimer);
    window.__aurumNoticeTimer = setTimeout(() => node.style.display='none', 3200);
  };
  const go = page => parent.postMessage({type:'aurum-navigate', page}, '*');
  const readFile = file => new Promise((resolve,reject) => {
    const reader = new FileReader(); reader.onload=()=>resolve(String(reader.result).split(',')[1]||'');
    reader.onerror=()=>reject(new Error('Could not read the selected file.')); reader.readAsDataURL(file);
  });
  const filePayload = async file => ({fileName:file.name,mimeType:file.type||'application/octet-stream',fileData:await readFile(file)});
  const checkFile = file => { if (!file) throw new Error('Please choose a file.'); if (file.size > 6*1024*1024) throw new Error('Please choose a file smaller than 6 MB.'); };
  const localDateInput = date => { const d=new Date(date.getTime()-date.getTimezoneOffset()*60000); return d.toISOString().slice(0,16); };

  // Authentication: never intercept the login submit button; the form must reach the API.
  const loginForm = $('#loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async event => {
      event.preventDefault();
      const submit = $('#loginSubmitBtn'); if (submit) submit.disabled = true;
      try {
        await api('/api/login',{method:'POST',body:JSON.stringify({email:$('#emailInput')?.value,password:$('#passwordInput')?.value})});
        toast('Login successful.'); go('home');
      } catch (error) { toast(error.message); }
      finally { if (submit) submit.disabled = false; }
    });
    const register = document.createElement('button');
    register.type='button'; register.textContent='Create demo account';
    register.style.cssText='width:100%;margin-top:10px;padding:11px;border:1px solid #c99a32;border-radius:10px;background:#f7e8bf;color:#174d3a;font-weight:700;cursor:pointer';
    register.addEventListener('click',async()=>{
      const email=$('#emailInput')?.value, password=$('#passwordInput')?.value;
      if(!email||!password) return toast('Enter your email and password first.');
      try { await api('/api/register',{method:'POST',body:JSON.stringify({email,password,name:email.split('@')[0]})}); toast('Demo account created.'); go('home'); }
      catch(error){toast(error.message);}
    });
    loginForm.insertAdjacentElement('afterend',register);
  }

  // Records and insurance: uploads are stored on the local Node server and tied to the signed-in account.
  if (location.pathname.includes('/records/')) {
    const recordForm=$('#recordForm'), recordsList=$('#recordsList'), recordStatus=$('#recordStatus');
    const insuranceForm=$('#insuranceForm'), insuranceStatus=$('#insuranceStatus'), insuranceSaved=$('#insuranceSaved');
    async function loadRecords(){
      try {
        const data=await api('/api/records'); $('#recordCount').textContent=`${data.records.length} file${data.records.length===1?'':'s'}`;
        recordsList.innerHTML='';
        if(!data.records.length){recordsList.innerHTML='<div class="empty">No medical records uploaded yet.<br>Your uploaded reports will appear here.</div>';return;}
        data.records.forEach(record=>{
          const row=document.createElement('div');row.className='record';
          const icon=document.createElement('div');icon.className='file-icon';icon.textContent=(record.mimeType||'').includes('pdf')?'PDF':'▧';
          const main=document.createElement('div');main.className='record-main';
          const title=document.createElement('div');title.className='record-title';title.textContent=record.title;
          const meta=document.createElement('div');meta.className='record-meta';meta.textContent=`${record.category} · ${record.date} · ${record.fileName||'Document'}`;
          main.append(title,meta);const actions=document.createElement('div');actions.className='record-actions';
          const view=document.createElement('a');view.className='btn secondary';view.textContent='View';view.href='/api/files/'+encodeURIComponent(record.fileId);view.target='_blank';view.rel='noopener';
          const del=document.createElement('button');del.className='btn danger';del.type='button';del.textContent='Delete';
          del.addEventListener('click',async()=>{if(!confirm('Delete this medical record?'))return;try{await api('/api/records/'+record.id,{method:'DELETE'});toast('Record deleted.');loadRecords();}catch(e){toast(e.message);}});
          actions.append(view,del);row.append(icon,main,actions);recordsList.append(row);
        });
      } catch(error){recordsList.innerHTML='<div class="empty">Please log in to view your records.</div>';toast(error.message);}
    }
    recordForm?.addEventListener('submit',async event=>{
      event.preventDefault();
      try {
        const file=$('#recordFile')?.files?.[0];checkFile(file);
        recordStatus.textContent='Uploading…';
        await api('/api/records',{method:'POST',body:JSON.stringify({...await filePayload(file),title:$('#recordTitle').value.trim()||file.name,category:$('#recordCategory').value})});
        recordForm.reset();recordStatus.textContent='Your record was uploaded successfully.';toast('Medical record saved.');await loadRecords();
      } catch(error){recordStatus.textContent=error.message;}
    });
    async function loadInsurance(){
      try {
        const data=await api('/api/insurance');
        if(!data.insurance){insuranceSaved.innerHTML='<p class="hint">No insurance details saved yet.</p>';return;}
        const item=data.insurance;$('#insurer').value=item.provider||'';$('#policyNumber').value=item.policyNumber||'';$('#memberId').value=item.memberId||'';$('#validTill').value=item.validTill||'';
        insuranceSaved.innerHTML='';const box=document.createElement('div');box.className='record';
        const main=document.createElement('div');main.className='record-main';const title=document.createElement('div');title.className='record-title';title.textContent=item.provider;
        const meta=document.createElement('div');meta.className='record-meta';meta.textContent=`Policy: ${item.policyNumber} · Member ID: ${item.memberId||'Not added'} · Valid until: ${item.validTill||'Not specified'}`;main.append(title,meta);box.append(main);
        if(item.fileId){const link=document.createElement('a');link.className='btn secondary';link.href='/api/files/'+encodeURIComponent(item.fileId);link.target='_blank';link.rel='noopener';link.textContent='View document';box.append(link);}
        insuranceSaved.append(box);
      } catch(error){insuranceStatus.textContent=error.message;}
    }
    insuranceForm?.addEventListener('submit',async event=>{
      event.preventDefault();
      try {
        const file=$('#insuranceFile')?.files?.[0];if(file)checkFile(file);
        insuranceStatus.textContent='Saving…';const payload={provider:$('#insurer').value.trim(),policyNumber:$('#policyNumber').value.trim(),memberId:$('#memberId').value.trim(),validTill:$('#validTill').value};
        if(file)Object.assign(payload,await filePayload(file));
        await api('/api/insurance',{method:'POST',body:JSON.stringify(payload)});insuranceStatus.textContent='Insurance details saved.';toast('Insurance details saved.');await loadInsurance();
      } catch(error){insuranceStatus.textContent=error.message;}
    });
    $('#clearInsurance')?.addEventListener('click',()=>{insuranceForm.reset();insuranceStatus.textContent='Form cleared. Saved insurance details are unchanged.';});
    $('#openScanner')?.addEventListener('click',()=>go('scan'));
    loadRecords();loadInsurance();
  }

  // Scanner: upload from device or invoke the mobile camera. Captures are saved to Records.
  if (location.pathname.includes('/scan/')) {
    let selectedType='Lab report';let chosenFile=null;
    const picker=document.createElement('input');picker.type='file';picker.accept='image/*,.pdf';picker.hidden=true;document.body.append(picker);
    const previewCount=$('#preview-count'),previewLabel=$('#preview-btn span.font-label-sm:last-child');
    const updatePreview=()=>{if(previewCount)previewCount.textContent=chosenFile?'1':'0';if(previewLabel)previewLabel.textContent=chosenFile?'Preview (1)':'Preview (0)';};
    $$('.doc-pill').forEach(button=>button.addEventListener('click',()=>{selectedType=button.dataset.docType||'Other';}));
    $('#upload-btn')?.addEventListener('click',()=>{picker.removeAttribute('capture');picker.click();});
    $('#shutter-btn')?.addEventListener('click',()=>{picker.setAttribute('capture','environment');picker.accept='image/*';picker.click();});
    picker.addEventListener('change',async()=>{
      chosenFile=picker.files?.[0]||null;if(!chosenFile)return;
      try {
        checkFile(chosenFile);toast('Uploading scan…');
        await api('/api/records',{method:'POST',body:JSON.stringify({...await filePayload(chosenFile),title:chosenFile.name.replace(/\.[^.]+$/,'')||'Scanned report',category:selectedType})});
        updatePreview();toast('Scan saved in Records.');setTimeout(()=>go('records'),700);
      } catch(error){toast(error.message);}
    });
    $('#preview-btn')?.addEventListener('click',()=>toast(chosenFile?`Selected: ${chosenFile.name}`:'Choose a file or take a photo first.'));
  }

  // Care Planner: use the page's existing controls; no extra panels are injected.
  if (location.pathname.includes('/care/')) {
    const sections=$$('main section');
    const apptSection=sections.find(s=>s.innerText.includes('Upcoming Appointments'));
    const reminderSection=sections.find(s=>s.innerText.includes('Follow-up Reminders'));
    const addAppt=apptSection?.querySelector(':scope > div:first-child button');
    const addReminder=reminderSection?.querySelector('button');
    const prepChecks=$$('#prep-sheet input[type="checkbox"]');
    const prepLabels=prepChecks.map(c=>c.closest('label')?.querySelector('span.font-label-md')?.textContent||'Checklist item');
    const timers=new Map();
    const schedule=(key,when,title,message)=>{
      if(timers.has(key))clearTimeout(timers.get(key));const delay=new Date(when).getTime()-Date.now();
      if(delay<=0||delay>2147480000)return;
      timers.set(key,setTimeout(async()=>{if('Notification'in window){if(Notification.permission==='default')try{await Notification.requestPermission();}catch(e){}if(Notification.permission==='granted')new Notification(title,{body:message});else toast(message);}else toast(message);timers.delete(key);},delay));
    };
    async function savePrep(show=false){try{await api('/api/prep',{method:'POST',body:JSON.stringify({items:prepChecks.map((c,i)=>({key:String(i),label:prepLabels[i],done:c.checked}))})});if(show)toast('Consultation preparation saved.');}catch(e){toast(e.message);}}
    async function loadPrep(){try{const d=await api('/api/prep');if(d.items.length)prepChecks.forEach((c,i)=>{const item=d.items.find(x=>x.key===String(i));if(item)c.checked=!!item.done;});}catch(e){toast(e.message);}}
    prepChecks.forEach(c=>c.addEventListener('change',()=>savePrep(false)));
    $('#save-prep-btn')?.addEventListener('click',()=>savePrep(true));

    const medBtn=$('#med-1-btn'),medName=$('#med-1-title')?.textContent?.trim()||'Metformin 500mg';
    const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
    async function loadDose(){try{const d=await api('/api/medication-log?day='+today());const item=d.logs.find(x=>x.medicine===medName);if(item&&medBtn&&(medBtn.getAttribute('data-taken')==='true')!==item.taken)window.toggleDose?.('med-1');}catch(e){toast(e.message);}}
    medBtn?.addEventListener('click',()=>setTimeout(async()=>{try{await api('/api/medication-log',{method:'POST',body:JSON.stringify({medicine:medName,day:today(),taken:medBtn.getAttribute('data-taken')==='true'})});toast(medBtn.getAttribute('data-taken')==='true'?'Dose marked as taken.':'Dose marked as not taken.');}catch(e){toast(e.message);}},0));

    async function loadReminders(){
      if(!reminderSection)return;
      try {
        const data=await api('/api/reminders');
        reminderSection.querySelectorAll('.aurum-reminder').forEach(n=>n.remove());
        // Remove the two static sample reminder cards, preserving the section heading and Add button.
        [...reminderSection.children].filter(n=>n.tagName==='DIV'&&n.querySelector('h4')).forEach(n=>n.remove());
        const count=reminderSection.querySelector('span.font-label-sm');if(count)count.textContent=`${data.reminders.filter(x=>!x.done).length} Pending`;
        data.reminders.sort((a,b)=>new Date(a.dueAt)-new Date(b.dueAt)).forEach(item=>{
          const card=document.createElement('div');card.className='aurum-reminder flex items-start justify-between p-space-md rounded-xl bg-surface-container-lowest shadow-sm gap-space-sm';
          card.setAttribute('role','button');card.tabIndex=0;
          card.innerHTML=`<div class="flex items-start gap-space-sm min-w-0"><div class="w-9 h-9 rounded-lg bg-tertiary-fixed flex items-center justify-center text-on-tertiary-fixed shrink-0"><span class="material-symbols-outlined text-[18px]">notifications_active</span></div><div class="flex flex-col min-w-0"><h4 class="font-label-lg text-label-lg font-semibold text-on-surface ${item.done?'line-through opacity-60':''}">${esc(item.title)}</h4><span class="font-body-sm text-body-sm text-on-surface-variant pt-0.5">Due ${esc(new Date(item.dueAt).toLocaleString())}</span></div></div><span class="px-2 py-0.5 rounded-full ${item.done?'bg-surface-container text-on-surface-variant':'bg-tertiary-container text-on-tertiary-container'} font-label-sm text-label-sm font-semibold shrink-0">${item.done?'Completed':esc(item.priority||'Routine')}</span>`;
          const toggle=async()=>{try{await api('/api/reminders/'+item.id,{method:'PATCH',body:JSON.stringify({done:!item.done})});await loadReminders();}catch(e){toast(e.message);}};
          card.addEventListener('click',toggle);card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle();}});reminderSection.insertBefore(card,addReminder||null);
          if(!item.done)schedule('rem-'+item.id,item.dueAt,'Aurum Health follow-up',item.title);
        });
      } catch(error){toast(error.message);}
    }
    addReminder?.addEventListener('click',async()=>{
      const title=prompt('What should we remind you about?');if(!title?.trim())return;
      const raw=prompt('When? Enter date and time (YYYY-MM-DDTHH:MM)',localDateInput(new Date(Date.now()+3600000)));if(!raw)return;
      const due=new Date(raw);if(Number.isNaN(due.getTime())||due.getTime()<=Date.now())return toast('Choose a valid future date and time.');
      const priority=(prompt('Priority: Routine or High','Routine')||'Routine').trim();
      try{await api('/api/reminders',{method:'POST',body:JSON.stringify({title:title.trim(),dueAt:due.toISOString(),priority})});await loadReminders();toast('Follow-up reminder saved.');}catch(e){toast(e.message);}
    });

    function calendarFile(appt){
      const start=new Date(appt.dateTime),end=new Date(start.getTime()+30*60000),fmt=d=>d.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
      const contents=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Aurum Health//Care Planner//EN','BEGIN:VEVENT',`UID:${appt.id}@aurumhealth.local`,`DTSTAMP:${fmt(new Date())}`,`DTSTART:${fmt(start)}`,`DTEND:${fmt(end)}`,`SUMMARY:Appointment with ${String(appt.doctor).replace(/[\\,;]/g,' ')}`,`LOCATION:${String(appt.clinic||'').replace(/[\\,;]/g,' ')}`,'END:VEVENT','END:VCALENDAR'].join('\r\n');
      const url=URL.createObjectURL(new Blob([contents],{type:'text/calendar;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='aurum-appointment.ics';a.click();URL.revokeObjectURL(url);
    }
    async function loadAppointments(){
      if(!apptSection)return;
      try {
        const data=await api('/api/appointments');apptSection.querySelectorAll('.aurum-appointment').forEach(n=>n.remove());
        // Remove the static sample card, not the section heading / Add control.
        [...apptSection.children].filter(n=>n.classList.contains('flex')&&n.classList.contains('flex-col')&&n.classList.contains('rounded-xl')).forEach(n=>n.remove());
        const upcoming=data.appointments.filter(x=>new Date(x.dateTime).getTime()>=Date.now()).sort((a,b)=>new Date(a.dateTime)-new Date(b.dateTime));
        upcoming.forEach(item=>{
          const card=document.createElement('div');card.className='aurum-appointment flex flex-col rounded-xl bg-surface-container-lowest p-space-md shadow-sm gap-space-md';
          card.innerHTML=`<div class="flex items-start gap-space-md"><div class="w-14 h-14 rounded-xl bg-surface-container flex items-center justify-center text-primary-container shrink-0"><span class="material-symbols-outlined text-3xl">medical_services</span></div><div class="flex flex-col min-w-0 flex-1"><div class="flex items-center justify-between gap-2"><h4 class="font-label-lg text-label-lg font-semibold text-primary-container truncate">${esc(item.doctor)}</h4><span class="px-2 py-0.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed font-label-sm text-label-sm">Upcoming</span></div><span class="font-label-md text-label-md text-secondary">${esc(item.specialty||'Appointment')}</span><p class="font-body-sm text-body-sm text-on-surface-variant">${esc(item.clinic||'Clinic not specified')}</p></div></div><div class="grid grid-cols-2 gap-space-xs bg-surface-container-low p-2.5 rounded-lg"><div><span class="font-label-sm text-label-sm text-on-surface-variant uppercase">Date &amp; Time</span><div class="font-label-md text-label-md font-semibold text-on-surface">${esc(new Date(item.dateTime).toLocaleString())}</div></div><div><span class="font-label-sm text-label-sm text-on-surface-variant uppercase">Location</span><div class="font-label-md text-label-md font-semibold text-on-surface">${esc(item.clinic||'Not specified')}</div></div></div><div class="flex items-center justify-between pt-space-xs"><button type="button" data-calendar class="inline-flex items-center gap-1 text-secondary font-label-md text-label-md font-semibold hover:underline">Add to Calendar</button><button type="button" data-details class="px-3.5 py-1.5 rounded-lg bg-surface-container-high text-on-secondary-fixed font-label-md text-label-md font-semibold">View Details</button></div>`;
          card.querySelector('[data-calendar]').addEventListener('click',()=>calendarFile(item));
          card.querySelector('[data-details]').addEventListener('click',()=>alert(`Doctor: ${item.doctor}\nSpecialty: ${item.specialty||'Not specified'}\nClinic: ${item.clinic||'Not specified'}\nDate: ${new Date(item.dateTime).toLocaleString()}`));
          apptSection.append(card);const reminderTime=new Date(item.dateTime).getTime()-86400000;if(reminderTime>Date.now())schedule('appt-'+item.id,reminderTime,'Appointment tomorrow',`You have an appointment with ${item.doctor} tomorrow.`);
        });
      } catch(error){toast(error.message);}
    }
    addAppt?.addEventListener('click',async()=>{
      const doctor=prompt('Doctor / provider name:');if(!doctor?.trim())return;
      const specialty=prompt('Specialty (optional):')||'',clinic=prompt('Clinic / location (optional):')||'';
      const raw=prompt('Appointment date and time (YYYY-MM-DDTHH:MM)',localDateInput(new Date(Date.now()+86400000)));if(!raw)return;
      const date=new Date(raw);if(Number.isNaN(date.getTime())||date.getTime()<=Date.now())return toast('Choose a valid future appointment date and time.');
      try{await api('/api/appointments',{method:'POST',body:JSON.stringify({doctor:doctor.trim(),specialty,clinic,dateTime:date.toISOString()})});await loadAppointments();toast('Appointment saved.');}catch(e){toast(e.message);}
    });
    // Existing Vitamin D3 reminder control.
    const vitaminButton=$$('main button').find(b=>b.innerText.toLowerCase().includes('remind'));
    vitaminButton?.addEventListener('click',async()=>{
      const raw=prompt('When should we remind you about Vitamin D3? (YYYY-MM-DDTHH:MM)',localDateInput(new Date(Date.now()+2*3600000)));if(!raw)return;
      const date=new Date(raw);if(Number.isNaN(date.getTime())||date.getTime()<=Date.now())return toast('Choose a valid future date and time.');
      try{await api('/api/reminders',{method:'POST',body:JSON.stringify({title:'Vitamin D3 (60,000 IU)',dueAt:date.toISOString(),priority:'Routine'})});await loadReminders();toast('Medicine reminder saved.');}catch(e){toast(e.message);}
    });
    loadPrep();loadDose();loadReminders();loadAppointments();
  }

  // Home dashboard: reminders and appointments are backed by the same saved APIs.
  if (location.pathname.includes('/home/')) {
    const medList=$('#homeMedicineList'), apptList=$('#homeAppointmentList'), activityList=$('#homeActivityList');
    const openDialog=id=>{const box=$('#'+id);if(box)box.classList.add('open');};
    const closeDialog=id=>{const box=$('#'+id);if(box)box.classList.remove('open');};
    $$('[data-close]').forEach(btn=>btn.addEventListener('click',()=>closeDialog(btn.dataset.close)));
    $$('.dialog-backdrop').forEach(box=>box.addEventListener('click',e=>{if(e.target===box)box.classList.remove('open');}));
    const setDate=(selector,date)=>{const el=$(selector);if(el)el.value=localDateInput(date);};
    async function loadHomeReminders(){
      if(!medList)return [];
      try{
        const data=await api('/api/reminders');const reminders=data.reminders||[];medList.innerHTML='';
        if(!reminders.length){medList.innerHTML='<div class="empty-state"><div class="empty-icon"><span class="material-symbols-outlined">medication</span></div><div><strong>No medicine reminders yet</strong><span>Add your first medicine and its due time to keep your routine on track.</span></div></div>';return reminders;}
        reminders.sort((a,b)=>new Date(a.dueAt)-new Date(b.dueAt)).forEach(item=>{
          const card=document.createElement('div');card.className='reminder-card';
          card.innerHTML=`<div class="medicine-row"><div class="med-icon"><span class="material-symbols-outlined">medication</span></div><div class="med-main"><div class="item-title">${esc(item.title)}</div><div class="item-meta">${esc(new Date(item.dueAt).toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}))}</div></div><button type="button" class="status-btn ${item.done?'done':''}" aria-label="${item.done?'Mark as not taken':'Mark as taken'}">${item.done?'✓ Taken':'Mark taken'}</button></div>`;
          card.querySelector('button').addEventListener('click',async()=>{try{await api('/api/reminders/'+item.id,{method:'PATCH',body:JSON.stringify({done:!item.done})});await refreshHome();toast(item.done?'Reminder reopened.':'Medicine marked as taken.');}catch(e){toast(e.message);}});
          medList.append(card);
        });return reminders;
      }catch(e){medList.innerHTML='<div class="empty-state"><div class="empty-icon"><span class="material-symbols-outlined">lock</span></div><div><strong>Sign in to view reminders</strong><span>Your saved reminders will show here after login.</span></div></div>';return [];}
    }
    async function loadHomeAppointments(){
      if(!apptList)return [];
      try{
        const data=await api('/api/appointments');const all=data.appointments||[];const upcoming=all.filter(x=>new Date(x.dateTime)>=new Date()).sort((a,b)=>new Date(a.dateTime)-new Date(b.dateTime));apptList.innerHTML='';
        if(!upcoming.length){apptList.innerHTML='<div class="empty-state"><div class="empty-icon"><span class="material-symbols-outlined">event_available</span></div><div><strong>No upcoming appointments</strong><span>Add a doctor visit and we’ll keep its date and details here.</span></div></div>';return all;}
        upcoming.forEach(item=>{
          const d=new Date(item.dateTime);const card=document.createElement('div');card.className='appointment-card';
          card.innerHTML=`<div class="date-chip"><b>${d.toLocaleDateString([], {day:'2-digit'})}</b><span>${d.toLocaleDateString([], {month:'short'})}</span></div><div class="appt-main"><div class="item-title">${esc(item.doctor)}</div><div class="item-meta">${esc(item.specialty||'Doctor visit')} · ${esc(item.clinic||'Location not added')}</div><div class="item-meta">${esc(d.toLocaleTimeString([], {hour:'numeric',minute:'2-digit'}))}</div><div class="appt-actions"><button type="button" data-cal class="text-action primary">Add to calendar</button><button type="button" data-detail class="text-action">View details</button></div></div>`;
          card.querySelector('[data-detail]').addEventListener('click',()=>alert(`Doctor: ${item.doctor}\nSpecialty: ${item.specialty||'Not specified'}\nClinic: ${item.clinic||'Not specified'}\nDate: ${d.toLocaleString()}`));
          card.querySelector('[data-cal]').addEventListener('click',()=>{const end=new Date(d.getTime()+1800000),fmt=x=>x.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');const ics=['BEGIN:VCALENDAR','VERSION:2.0','BEGIN:VEVENT',`UID:${item.id}@aurumhealth.local`,`DTSTART:${fmt(d)}`,`DTEND:${fmt(end)}`,`SUMMARY:${String(item.doctor).replace(/[,;]/g,' ')}`,'END:VEVENT','END:VCALENDAR'].join('\r\n');const u=URL.createObjectURL(new Blob([ics],{type:'text/calendar'}));const a=document.createElement('a');a.href=u;a.download='aurum-appointment.ics';a.click();URL.revokeObjectURL(u);});
          apptList.append(card);
        });return all;
      }catch(e){apptList.innerHTML='<div class="empty-state"><div class="empty-icon"><span class="material-symbols-outlined">lock</span></div><div><strong>Sign in to view appointments</strong><span>Your upcoming visits will show here after login.</span></div></div>';return [];}
    }
    async function loadHomeActivity(){
      if(!activityList)return;
      try{
        const [r,a,f]=await Promise.all([api('/api/reminders'),api('/api/appointments'),api('/api/records')]);
        const events=[];
        (r.reminders||[]).forEach(x=>events.push({date:x.createdAt||x.dueAt,title:x.done?'Medicine reminder completed':'Medicine reminder added',detail:x.title,icon:x.done?'check_circle':'medication'}));
        (a.appointments||[]).forEach(x=>events.push({date:x.createdAt||x.dateTime,title:'Appointment scheduled',detail:`${x.doctor}${x.specialty?' · '+x.specialty:''}`,icon:'event'}));
        (f.records||[]).forEach(x=>events.push({date:x.createdAt||x.date||new Date().toISOString(),title:'Medical record added',detail:x.title||x.fileName||'New health document',icon:'folder'}));
        events.sort((x,y)=>new Date(y.date)-new Date(x.date));activityList.innerHTML='';
        if(!events.length){activityList.innerHTML='<div class="empty-state"><div class="empty-icon"><span class="material-symbols-outlined">history</span></div><div><strong>Your activity will appear here</strong><span>When you add a reminder, appointment or medical record, you’ll see it in this timeline.</span></div></div>';return;}
        events.slice(0,5).forEach(x=>{const row=document.createElement('div');row.className='activity-item';const date=new Date(x.date);row.innerHTML=`<div class="activity-icon"><span class="material-symbols-outlined">${esc(x.icon)}</span></div><div class="activity-copy"><strong>${esc(x.title)}</strong><span>${esc(x.detail)}</span></div><div class="activity-time">${Number.isNaN(date.getTime())?'':date.toLocaleDateString([], {month:'short',day:'numeric'})}</div>`;activityList.append(row);});
      }catch(e){activityList.innerHTML='<div class="empty-state"><div class="empty-icon"><span class="material-symbols-outlined">history</span></div><div><strong>Activity is unavailable</strong><span>Sign in to view your recent health activity.</span></div></div>';}
    }
    async function refreshHome(){await Promise.all([loadHomeReminders(),loadHomeAppointments()]);await loadHomeActivity();}
    $('#homeAddMedicine')?.addEventListener('click',()=>{setDate('#medicineWhen',new Date(Date.now()+3600000));openDialog('medicineDialog');$('#medicineName')?.focus();});
    $('#homeAddAppointment')?.addEventListener('click',()=>{setDate('#appointmentWhen',new Date(Date.now()+86400000));openDialog('appointmentDialog');$('#appointmentDoctor')?.focus();});
    $('#medicineForm')?.addEventListener('submit',async e=>{e.preventDefault();const title=$('#medicineName').value.trim(),date=new Date($('#medicineWhen').value);if(!title)return toast('Enter a medicine name.');if(Number.isNaN(date.getTime()))return toast('Choose a valid date and time.');try{await api('/api/reminders',{method:'POST',body:JSON.stringify({title,dueAt:date.toISOString(),priority:'Routine'})});$('#medicineForm').reset();closeDialog('medicineDialog');await refreshHome();toast('Medicine reminder saved.');}catch(err){toast(err.message);}});
    $('#appointmentForm')?.addEventListener('submit',async e=>{e.preventDefault();const doctor=$('#appointmentDoctor').value.trim(),specialty=$('#appointmentSpecialty').value.trim(),clinic=$('#appointmentClinic').value.trim(),date=new Date($('#appointmentWhen').value);if(!doctor)return toast('Enter the doctor or provider name.');if(Number.isNaN(date.getTime())||date.getTime()<=Date.now())return toast('Choose a valid future appointment date and time.');try{await api('/api/appointments',{method:'POST',body:JSON.stringify({doctor,specialty,clinic,dateTime:date.toISOString()})});$('#appointmentForm').reset();closeDialog('appointmentDialog');await refreshHome();toast('Appointment saved.');}catch(err){toast(err.message);}});
    $('#openPremium')?.addEventListener('click',()=>go('premium'));
    refreshHome();
  }

  // Premium hub: paid-feature demo; Family Vault remains functional but is no longer in Profile.
  if (location.pathname.includes('/premium/')) {
    const list=$('#premiumFamilyList');
    async function renderPremiumFamily(){if(!list)return;try{const data=await api('/api/family');list.innerHTML='';if(!data.members.length){list.innerHTML='<p class="text-sm text-on-surface-variant">No family members added yet.</p>';return;}data.members.forEach(m=>{const row=document.createElement('div');row.className='p-3 rounded-lg bg-surface-container flex items-center justify-between gap-2';row.innerHTML=`<span><strong>${esc(m.name)}</strong><small class="block text-on-surface-variant">${esc(m.relationship)}</small></span><button data-remove class="text-xs text-secondary font-semibold">Remove</button>`;row.querySelector('button').addEventListener('click',async()=>{if(!confirm(`Remove ${m.name}?`))return;try{await api('/api/family/'+m.id,{method:'DELETE'});renderPremiumFamily();}catch(e){toast(e.message);}});list.append(row);});}catch(e){list.innerHTML='<p class="text-sm">Sign in to use Family Health Vault.</p>';}}
    $('#premiumPrep')?.addEventListener('click',()=>go('care'));
    $('#premiumAddFamily')?.addEventListener('click',async()=>{const name=prompt('Family member full name:');if(!name?.trim())return;const relationship=prompt('Relationship (e.g. Parent, Spouse, Child):');if(!relationship?.trim())return;const dob=prompt('Date of birth (optional, YYYY-MM-DD):')||'',phone=prompt('Phone number (optional):')||'';try{await api('/api/family',{method:'POST',body:JSON.stringify({name:name.trim(),relationship:relationship.trim(),dob,phone})});await renderPremiumFamily();toast('Family member added.');}catch(e){toast(e.message);}});
    renderPremiumFamily();
  }

  // Profile: connect the existing Edit Profile, Family Vault, and Log Out controls.
  if (location.pathname.includes('/profile/')) {
    const editButton=$$('button').find(b=>b.innerText.includes('Edit Profile'));
    editButton?.addEventListener('click',async()=>{
      try{const data=await api('/api/me');const user=data.user;const name=prompt('Full name:',user.name||'');if(name===null)return;const phone=prompt('Phone number:',user.phone||'')||'';const dob=prompt('Date of birth (YYYY-MM-DD):',user.dob||'')||'';await api('/api/profile',{method:'PUT',body:JSON.stringify({name,phone,dob})});toast('Profile updated.');}catch(e){toast(e.message);}
    });
    const passwordButton=$$('button').find(b=>b.innerText.toLowerCase().includes('change security password'));
    passwordButton?.addEventListener('click',async()=>{
      const currentPassword=prompt('Enter your current password:');if(currentPassword===null)return;
      const newPassword=prompt('Enter a new password (at least 4 characters):');if(newPassword===null)return;
      try{await api('/api/password',{method:'POST',body:JSON.stringify({currentPassword,newPassword})});toast('Security password updated.');}catch(e){toast(e.message);}
    });
    const logoutButton=$$('button').find(b=>b.innerText.toLowerCase().includes('log out'));
    logoutButton?.addEventListener('click',async()=>{try{await api('/api/logout',{method:'POST'});go('login');}catch(e){toast(e.message);}});
    const familySection=$$('main section').find(s=>s.innerText.includes('Family Health Vault'));
    const addMember=[...(familySection?.querySelectorAll('button')||[])].find(b=>b.innerText.includes('Add Member'));
    async function renderMembers(){
      try{
        const data=await api('/api/family');familySection?.querySelectorAll('.aurum-family-member').forEach(n=>n.remove());
        const anchor=[...(familySection?.querySelectorAll('button')||[])].find(b=>b.innerText.includes('Add Member'))?.parentElement;
        data.members.forEach(member=>{
          const node=document.createElement('div');node.className='aurum-family-member bg-surface-container-low p-space-sm rounded-lg flex items-start gap-space-sm';
          node.innerHTML=`<div class="w-12 h-12 rounded-full bg-surface-container-high flex items-center justify-center text-primary shrink-0"><span class="material-symbols-outlined">person</span></div><div class="flex-1 min-w-0"><div class="flex items-center justify-between"><h4 class="font-label-lg text-label-lg text-primary font-bold truncate">${esc(member.name)}</h4><button type="button" data-family-delete class="text-xs px-2 py-1 rounded bg-surface-container">Remove</button></div><p class="font-body-sm text-body-sm text-on-surface-variant">${esc(member.relationship)}${member.dob?' · DOB '+esc(member.dob):''}</p>${member.phone?`<p class="font-body-sm text-body-sm text-on-surface-variant">${esc(member.phone)}</p>`:''}</div>`;
          node.querySelector('[data-family-delete]').addEventListener('click',async()=>{if(!confirm(`Remove ${member.name} from Family Vault?`))return;try{await api('/api/family/'+member.id,{method:'DELETE'});renderMembers();}catch(e){toast(e.message);}});
          familySection?.insertBefore(node,anchor||null);
        });
      }catch(e){toast(e.message);}
    }
    addMember?.addEventListener('click',async()=>{
      const name=prompt('Family member full name:');if(!name?.trim())return;const relationship=prompt('Relationship (e.g. Parent, Spouse, Child):');if(!relationship?.trim())return;
      const dob=prompt('Date of birth (optional, YYYY-MM-DD):')||'',phone=prompt('Phone number (optional):')||'';
      try{await api('/api/family',{method:'POST',body:JSON.stringify({name:name.trim(),relationship:relationship.trim(),dob,phone})});await renderMembers();toast('Family member added.');}catch(e){toast(e.message);}
    });
    renderMembers();
  }

  // Report screen: download/share the visible demo summary and open the latest saved record.
  if (location.pathname.includes('/report/')) {
    const summaryText = () => {
      const heading = $('h2')?.innerText || 'Complete Blood Count (CBC)';
      const sections = $$('main h2, main h3, main h4');
      const details = sections.map(node => node.innerText.trim()).filter(Boolean);
      const paragraphs = $$('main p').map(node => node.innerText.trim()).filter(Boolean);
      return ['Aurum Health — Report Summary', heading, '', ...details, '', ...paragraphs,
        '', 'Educational demo only. This is not a medical diagnosis; consult a qualified clinician.'].join('\n');
    };
    $('button[aria-label="Download report"]')?.addEventListener('click',()=>{
      const blob=new Blob([summaryText()],{type:'text/plain;charset=utf-8'});const url=URL.createObjectURL(blob);
      const a=document.createElement('a');a.href=url;a.download='Aurum-Health-CBC-Summary.txt';a.click();URL.revokeObjectURL(url);toast('Report summary downloaded.');
    });
    $('button[aria-label="Share report"]')?.addEventListener('click',async()=>{
      try{await navigator.clipboard.writeText(summaryText());toast('Report summary copied.');}
      catch(e){toast('Clipboard access is unavailable in this browser.');}
    });
    const fullPdf=$$('button').find(b=>b.innerText.toLowerCase().includes('view full pdf'));
    fullPdf?.addEventListener('click',async()=>{
      try{const data=await api('/api/records');const latest=data.records[0];if(!latest){toast('Upload a report in Records first.');return;}window.open('/api/files/'+encodeURIComponent(latest.fileId),'_blank','noopener');}
      catch(e){toast(e.message);}
    });
    const compare=$$('button').find(b=>b.innerText.toLowerCase().includes('compare with previous'));
    compare?.addEventListener('click',()=>toast('Comparison is a demo: upload a second report to compare your records manually in Records.'));
  }

  // Emergency controls remain demonstrative and never pretend to call a service.
  if(location.pathname.includes('/emergency/')) {
    $$('button,a').forEach(element=>{const label=(element.innerText||element.getAttribute('aria-label')||'').toLowerCase();if(label.includes('call')||label.includes('ambulance'))element.addEventListener('click',event=>{event.preventDefault();toast('College demo only: no emergency call was placed. Contact your local emergency number in a real emergency.');});});
  }
})();
