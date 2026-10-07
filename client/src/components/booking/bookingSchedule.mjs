export function bookingDates(start,end,mode='period',days=[1,2,3,4,5],interval=1,selected=[]) {
 if(!start||!end||end<start)return {dates:[],error:''};
 const first=new Date(`${start}T00:00:00Z`),last=new Date(`${end}T00:00:00Z`),span=Math.round((last-first)/86400000)+1;
 if(!Number.isFinite(span)||span<1)return {dates:[],error:'Choose a valid service period.'};
 if(span>366)return {dates:[],error:'Choose a service period of at most 366 days.'};
 if(!Number.isInteger(Number(interval))||interval<1||interval>52)return {dates:[],error:'Repeat every 1 to 52 weeks.'};
 const chosen=new Set(selected),dates=[];
 for(let offset=0;offset<span;offset++){const d=new Date(first.getTime()+offset*86400000),key=d.toISOString().slice(0,10);if(mode==='period'||mode==='dates'&&chosen.has(key)||mode==='weekly'&&days.includes(d.getUTCDay())&&Math.floor(offset/7)%Number(interval)===0)dates.push(key);}
 return {dates,error:''};
}
