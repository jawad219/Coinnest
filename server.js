/* CoinNest "server". Saari rules yahan hain. Abhi localStorage mock hai;
   baad mein isi logic ko Cloudflare Worker / Firebase Functions par move karna hai.
   Client kabhi coins ki miqdaar nahi bhejta, sirf action (e.g. "checkin"). */
(function(){
const K='cn_db',DAY=()=>new Date().toISOString().slice(0,10),YD=()=>new Date(Date.now()-864e5).toISOString().slice(0,10);
const def=()=>({n:1,users:{},wd:[],promos:{},cfg:{cpr:100,minRs:100,checkin:[5,5,10,10,15,15,50],pop:1,maxPops:25,plays:3,artCoins:3,artSecs:15,artDaily:5,adCoins:5,adSecs:15,adDaily:10,ref:50,notice:'',off:false,pw:'admin123'}});
let db;const load=()=>{try{db=JSON.parse(localStorage.getItem(K))}catch(e){}db=db||def()},save=()=>localStorage.setItem(K,JSON.stringify(db));
const rnd=()=>Math.random().toString(36).slice(2,10),C=()=>db.cfg;
const U=t=>{const[i,s]=(t||'').split('.'),u=db.users[i];if(!u||u.sec!==s)throw'Please login again';if(u.ban)throw'Account blocked';if(C().off)throw'App is under maintenance';if(u.d.day!==DAY())u.d={day:DAY(),ad:0,art:[],pl:0};return u};
const add=(u,n,w)=>{u.coins+=n;if(n>0)u.total+=n;u.log.unshift({t:Date.now(),n,w});u.log.length=Math.min(u.log.length,30)};
const wait=(t0,s)=>{if(!t0||Date.now()-t0<s*1000)throw'Too fast. Let the timer finish'};
const pub=u=>{const{sec,dev,...r}=u;return r};
const A={
login(p){const e=(p.email||'').trim().toLowerCase();if(!/^\S+@\S+\.\S+$/.test(e))throw'Enter a valid email';
let u=Object.values(db.users).find(x=>x.email===e);
if(!u){if(Object.values(db.users).some(x=>x.dev===p.dev))throw'This device already has an account';
u={id:'u'+db.n++,sec:rnd()+rnd(),email:e,name:(p.name||e.split('@')[0]).slice(0,20),dev:p.dev,coins:0,total:0,streak:0,last:'',d:{},promos:[],log:[],refs:0,joined:Date.now()};
u.code='CN'+u.id.slice(1)+rnd().slice(0,3).toUpperCase();db.users[u.id]=u;
const r=Object.values(db.users).find(x=>x.id!==u.id&&x.code===(p.ref||'').trim().toUpperCase());
if(r){add(u,C().ref,'Referral bonus');add(r,C().ref,'Friend joined');r.refs++}}
if(u.ban)throw'Account blocked';return{t:u.id+'.'+u.sec}},
me(p,t){const u=U(t);return{u:pub(u),cfg:{...C(),pw:undefined},d:u.d}},
checkin(p,t){const u=U(t);if(u.last===DAY())throw'Already claimed today';u.streak=u.last===YD()?u.streak+1:1;u.last=DAY();const c=C().checkin[(u.streak-1)%7];add(u,c,'Daily check-in');return{c}},
gs(p,t){const u=U(t);if(u.d.pl>=C().plays)throw'No plays left today';u.d.pl++;u.g=Date.now()},
ge(p,t){const u=U(t);wait(u.g,9.5);const n=Math.max(0,Math.min(+p.pops|0,C().maxPops));u.g=0;const c=n*C().pop;if(c)add(u,c,'Balloon game');return{c}},
as(p,t){const u=U(t);const i=+p.id;if(u.d.art.includes(i))throw'Already read';if(u.d.art.length>=C().artDaily)throw'Daily article limit reached';u.a={i,t:Date.now()}},
ac(p,t){const u=U(t);if(!u.a)throw'Start reading first';wait(u.a.t,C().artSecs);u.d.art.push(u.a.i);u.a=0;add(u,C().artCoins,'Article');return{c:C().artCoins}},
ads(p,t){const u=U(t);if(u.d.ad>=C().adDaily)throw'Daily ad limit reached';u.ad=Date.now()},
adc(p,t){const u=U(t);wait(u.ad,C().adSecs);u.ad=0;u.d.ad++;add(u,C().adCoins,'Rewarded ad');return{c:C().adCoins}},
promo(p,t){const u=U(t),k=(p.code||'').trim().toUpperCase(),x=db.promos[k];if(!x)throw'Invalid code';if(u.promos.includes(k))throw'Code already used';if(x.used>=x.limit)throw'Code expired';x.used++;u.promos.push(k);add(u,x.coins,'Promo '+k);return{c:x.coins}},
wd(p,t){const u=U(t),rs=Math.floor(+p.rs),c=rs*C().cpr;if(!(rs>=C().minRs))throw'Minimum withdraw is Rs '+C().minRs;if(c>u.coins)throw'Not enough coins';
if(!p.method||!/^[\w\s-]{6,30}$/.test(p.acct||''))throw'Enter a valid account number';if(db.wd.some(w=>w.uid===u.id&&w.st==='pending'))throw'You already have a pending request';
add(u,-c,'Withdraw Rs '+rs);db.wd.unshift({id:db.wd.length+1,uid:u.id,name:u.name,rs,c,method:p.method,acct:p.acct,st:'pending',t:Date.now()})},
mywd(p,t){const u=U(t);return db.wd.filter(w=>w.uid===u.id)},
board(){return Object.values(db.users).filter(u=>!u.ban).sort((a,b)=>b.total-a.total).slice(0,10).map(u=>({n:u.name,c:u.total}))}};
const ADM={
stats(){const us=Object.values(db.users);return{users:us.length,coins:us.reduce((s,u)=>s+u.coins,0),pending:db.wd.filter(w=>w.st==='pending').length,paid:db.wd.filter(w=>w.st==='paid').reduce((s,w)=>s+w.rs,0)}},
users(){return Object.values(db.users).map(pub)},
ban(p){const u=db.users[p.id];u.ban=!u.ban},
adjust(p){const u=db.users[p.id],n=Math.trunc(+p.n);if(!n)throw'Enter amount';add(u,n,'Admin adjust')},
wds(){return db.wd},
wdset(p){const w=db.wd.find(x=>x.id===p.id);if(w.st!=='pending')throw'Already processed';w.st=p.ok?'paid':'rejected';if(!p.ok)add(db.users[w.uid],w.c,'Withdraw refund')},
promos(){return db.promos},
promoAdd(p){const k=(p.code||'').trim().toUpperCase();if(!k||!(+p.coins>0))throw'Fill code and coins';db.promos[k]={coins:+p.coins,limit:+p.limit||100,used:0}},
promoDel(p){delete db.promos[p.code]},
cfg(){return{...C(),pw:undefined}},
cfgSet(p){for(const k in p){if(k==='pw'){if(p.pw)C().pw=p.pw}else if(k==='notice')C().notice=String(p[k]).slice(0,200);else if(k==='off')C().off=!!p[k];else if(typeof C()[k]==='number'&&+p[k]>=0)C()[k]=+p[k]}}};
window.API={call(a,p,t){return new Promise((ok,no)=>setTimeout(()=>{try{load();let r;
if(a.startsWith('adm_')){if(t!==C().pw)throw'Wrong admin password';r=ADM[a.slice(4)](p||{})}else r=A[a](p||{},t);
save();ok(JSON.parse(JSON.stringify(r===undefined?{}:r)))}catch(e){no(typeof e==='string'?e:'Something went wrong')}},120))}};
})();
