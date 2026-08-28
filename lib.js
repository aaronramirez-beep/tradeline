/* ============================================================
   Tradeline — shared library
   Pure helpers, constants, state factories.
   Loaded by app.html and testable via Vitest.
   ============================================================ */

let UID = 1000;
const uid = p => (p||'') + (++UID);
const money = n => ((n||0)<0?'−':'') + '$' + Math.abs(n||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const iso = d => d.toISOString().slice(0,10);
const today = iso(new Date());
const daysFromNow = n => iso(new Date(Date.now()+n*864e5));
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const dfmt = d => { if(!d) return '—'; const [y,m,day]=d.split('-'); return `${MONTHS[+m-1]} ${+day}, ${y}`; };
const shortDate = d => { const [y,m,day]=d.split('-'); return `${MONTHS[+m-1]} ${+day}`; };
const esc = s => String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

const PLANS = [
  {key:'core',    name:'Core',    mo:49,  users:1,  feats:['Quotes, jobs & invoicing','Online payments','Client manager (CRM)','Online requests','Reporting basics']},
  {key:'connect', name:'Connect', mo:139, users:5,  feats:['Everything in Core','QuickBooks Online sync','Time & expense tracking','Automated reminders','Job checklists']},
  {key:'grow',    name:'Grow',    mo:199, users:10, feats:['Everything in Connect','Job costing & reports','Custom automations','Two-way SMS','Quote add-ons & upsells']},
  {key:'plus',    name:'Plus',    mo:499, users:15, feats:['Everything in Grow','Sales Pipeline included','Marketing Suite included','AI Receptionist included','Premium support']},
];
const RANK = {core:0, connect:1, grow:2, plus:3};
const ADDONS = {ai:{name:'AI Receptionist',mo:29}, marketing:{name:'Marketing Suite',mo:79}, pipeline:{name:'Sales Pipeline',mo:49}};

const FEAT = {
  timesheets:{name:'Timesheets & time tracking', min:'connect', desc:'Track crew hours against each job, feeding labor cost into job costing.'},
  expenses:{name:'Expense tracking', min:'connect', desc:'Log material and supply spend per job from the field.'},
  reports:{name:'Job costing & reports', min:'grow', desc:'See quoted vs invoiced vs actual labor + materials, per job, with margins.'},
  automations:{name:'Custom automations', min:'grow', desc:'Auto quote follow-ups, invoice reminders, review requests and more.'},
  pipeline:{name:'Sales Pipeline', min:'plus', addon:'pipeline', desc:'Kanban view of every lead from request → quoted → won.'},
  marketing:{name:'Marketing Suite', min:'plus', addon:'marketing', desc:'Review requests, email campaigns and referral tracking.'},
  ai:{name:'AI Receptionist', min:'plus', addon:'ai', desc:'Answers missed & after-hours calls, books requests for you.'},
};
function has(f){
  const m = FEAT[f]; if(!m) return true;
  if (RANK[state.plan] >= RANK[m.min]) return true;
  if (m.addon && state.addons[m.addon]) return true;
  return false;
}

const client = id => state.clients.find(c=>c.id===id) || {name:'—',contact:'',address:'',phone:'',email:''};
const quoteTotal = q => q.items.reduce((s,i)=>s+i.q*i.p,0);
const invTotal = inv => inv.items.reduce((s,i)=>s+i.q*i.p,0);
const invPaid = inv => state.payments.filter(p=>p.invoiceId===inv.id).reduce((s,p)=>s+p.amount,0);
const invBalance = inv => invTotal(inv)-invPaid(inv);
const jobLabor = jid => state.timesheets.filter(t=>t.jobId===jid).reduce((s,t)=>s+t.hours*t.rate,0);
const jobExp = jid => state.expenses.filter(e=>e.jobId===jid).reduce((s,e)=>s+e.amount,0);
const pill = (txt,cls) => `<span class="pill ${cls}">${txt}</span>`;
const statusPill = s => ({
  draft:pill('Draft','p-slate'), sent:pill('Sent','p-blue'), approved:pill('Approved','p-green'),
  scheduled:pill('Scheduled','p-blue'), in_progress:pill('In progress','p-amber'), complete:pill('Complete','p-green'),
  paid:pill('Paid','p-green'), overdue:pill('Overdue','p-red'), new:pill('New','p-amber'), converted:pill('Converted','p-green')
}[s] || pill(s,'p-slate'));

/* ============================ STATE ============================ */
function baseState(){ return {
  plan:'core',
  addons:{ai:false, marketing:false, pipeline:false},
  extraUsers:0,
  integrations:{},
  clients:[], requests:[], quotes:[], jobs:[], invoices:[], payments:[], timesheets:[], expenses:[],
  automations: [
    {key:'a1', name:'Quote follow-up', desc:'Email + text the client if a quote sits unanswered for 3 days', on:false},
    {key:'a2', name:'Visit reminder', desc:'Text the client the day before a scheduled visit', on:false},
    {key:'a3', name:'Invoice reminder', desc:'Nudge unpaid invoices at 3, 7 and 14 days past due', on:false},
    {key:'a4', name:'Review request', desc:'Ask for a Google review 2 hours after a job is marked complete', on:false},
    {key:'a5', name:'Rebook nudge', desc:'Offer repeat clients a booking link 6 months after their last job', on:false},
  ],
  autoLog:[], aiOn:true, aiCalls:[], reviewSent:{}, campaigns:[], aiSimIdx:0,
}; }
function seedState(){ const s = baseState(); Object.assign(s, {
  clients: [
    {id:'c1', name:'Whitmore Residence', contact:'Dana Whitmore', type:'Homeowner', phone:'(303) 555-0182', email:'dana.w@example.com', address:'418 Alpine Ct, Boulder, CO'},
    {id:'c2', name:'Summit Ridge Builders', contact:'Miguel Alvarez', type:'General Contractor', phone:'(720) 555-0143', email:'miguel@summitridge.co', address:'2200 Commerce Pkwy, Denver, CO'},
    {id:'c3', name:'Harborview Apartments', contact:'Priya Nair', type:'Property Mgr', phone:'(303) 555-0176', email:'pnair@harborviewpm.com', address:'88 Lakeshore Dr, Aurora, CO'},
    {id:'c4', name:'Coleman Custom Home', contact:'Rick Coleman', type:'Homeowner', phone:'(970) 555-0119', email:'rick.coleman@example.com', address:'12 Foothill Rd, Longmont, CO'},
  ],
  requests: [
    {id:'r1', name:'Elena Marsh', phone:'(303) 555-0164', service:'Exterior repaint — 2-story home', pref:daysFromNow(8), source:'Online booking', status:'new'},
    {id:'r2', name:'Foothills Dental (office)', phone:'(720) 555-0190', service:'Reception & hallway repaint, weekend work', pref:daysFromNow(14), source:'Website form', status:'new'},
  ],
  quotes: [
    {id:'q1', clientId:'c2', title:'Level 5 finish — 14 units, Building C', status:'approved', date:daysFromNow(-12),
      items:[{d:'Level 5 drywall skim coat (sq ft)',q:9800,p:1.35},{d:'Prime & seal — new drywall',q:9800,p:0.42},{d:'Corner bead install & finish (lf)',q:640,p:2.10}]},
    {id:'q2', clientId:'c1', title:'Interior repaint — main level + stairwell', status:'sent', date:daysFromNow(-4),
      items:[{d:'Wall prep, patch & sand',q:1,p:850},{d:'Interior paint — walls, 2 coats (sq ft)',q:2400,p:1.15},{d:'Trim & door enamel finish (lf)',q:380,p:3.25}]},
    {id:'q3', clientId:'c4', title:'Cabinet refinishing — kitchen + island', status:'draft', date:daysFromNow(-2),
      items:[{d:'Degloss, sand & prep (per door/drawer)',q:34,p:28},{d:'Spray finish — 2 coats lacquer',q:34,p:62},{d:'Onsite spray booth setup',q:1,p:450}]},
  ],
  jobs: [
    {id:'j1', clientId:'c2', quoteId:'q1', title:'Level 5 finish — 14 units, Building C', date:daysFromNow(2), crew:'Crew A — Luis, Marco', status:'scheduled',
      checklist:[{t:'Confirm units are drywalled & ready',done:true},{t:'Stage skim coat materials',done:false},{t:'Mask & protect finished floors',done:false},{t:'Skim coat + sand',done:false},{t:'Prime & final walk',done:false}]},
    {id:'j2', clientId:'c3', quoteId:null, title:'Common-hallway patch & repaint — floors 2-3', date:daysFromNow(-3), crew:'Crew B — Tanya, Deshawn', status:'complete',
      checklist:[{t:'Patch drywall dings',done:true},{t:'Sand & spot prime',done:true},{t:'Repaint hallways, 2 coats',done:true},{t:'Touch-up & final walk',done:true}]},
  ],
  invoices: [
    {id:'i1', clientId:'c3', jobId:'j2', title:'Common-hallway patch & repaint — floors 2-3', status:'sent', date:daysFromNow(-2), due:daysFromNow(12),
      items:[{d:'Drywall patch & repair',q:1,p:1200},{d:'Repaint common hallways (sq ft)',q:2100,p:1.05},{d:'Materials & supplies',q:1,p:340}]},
    {id:'i2', clientId:'c2', jobId:null, title:'Deposit — Building A stairwell finish', status:'paid', date:daysFromNow(-20), due:daysFromNow(-13),
      items:[{d:'Project deposit (30%)',q:1,p:4200}]},
  ],
  payments: [
    {id:'p1', invoiceId:'i2', amount:4200, method:'ACH bank transfer', date:daysFromNow(-16)},
  ],
  timesheets: [
    {id:'t1', jobId:'j2', worker:'Tanya R.', hours:14, rate:45, date:daysFromNow(-3)},
    {id:'t2', jobId:'j2', worker:'Deshawn K.', hours:12, rate:42, date:daysFromNow(-3)},
    {id:'t3', jobId:'j1', worker:'Luis G.', hours:6, rate:48, date:daysFromNow(-1)},
  ],
  expenses: [
    {id:'e1', jobId:'j2', desc:'Paint & patch compound — SW ProMar', amount:412.80, date:daysFromNow(-4)},
    {id:'e2', jobId:'j2', desc:'Masking film, tape, sleeves', amount:86.40, date:daysFromNow(-4)},
    {id:'e3', jobId:'j1', desc:'Level 5 skim compound (pallet)', amount:1240.00, date:daysFromNow(-2)},
  ],
  automations: [
    {key:'a1', name:'Quote follow-up', desc:'Email + text the client if a quote sits unanswered for 3 days', on:true},
    {key:'a2', name:'Visit reminder', desc:'Text the client the day before a scheduled visit', on:true},
    {key:'a3', name:'Invoice reminder', desc:'Nudge unpaid invoices at 3, 7 and 14 days past due', on:false},
    {key:'a4', name:'Review request', desc:'Ask for a Google review 2 hours after a job is marked complete', on:false},
    {key:'a5', name:'Rebook nudge', desc:'Offer repeat clients a booking link 6 months after their last job', on:false},
  ],
  autoLog: [
    {when:shortDate(daysFromNow(-1)), msg:'Quote follow-up sent to Dana Whitmore (Q2, day 3 unanswered)'},
    {when:shortDate(daysFromNow(-3)), msg:'Visit reminder texted to Harborview Apartments'},
  ],
  aiOn:true,
  aiCalls: [
    {when:shortDate(daysFromNow(-2))+', 9:12 PM', caller:'(303) 555-0164', outcome:'Booked request', lines:[
      ['caller','Hi, do you do exterior repaints? Our HOA deadline is end of August.'],
      ['ai','We do! We handle full exterior repaints. Can I grab your name and a good date for a free estimate?'],
      ['ai','Booked: estimate request for Elena Marsh, week of Jul 27. Aaron will confirm by text.']]},
  ],
  reviewSent:{},
  campaigns:[],
  aiSimIdx:0,
}); return s; }

let state = null;

function getState() { return state; }
function setState(s) { state = s; }

window.TL = {
  uid, money, iso, today, daysFromNow, dfmt, shortDate, esc,
  MONTHS, PLANS, RANK, ADDONS, FEAT, has,
  client, quoteTotal, invTotal, invPaid, invBalance, jobLabor, jobExp,
  pill, statusPill, baseState, seedState,
  get state() { return state; },
  set state(s) { state = s; },
};
