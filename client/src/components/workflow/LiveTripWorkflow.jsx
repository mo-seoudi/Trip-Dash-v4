import React from 'react';
import { FiArrowRight, FiCheck, FiClock } from 'react-icons/fi';
import { getTripAttention } from '../trips/TripAttention';
import './workflow.css';
const phases = [
 ['Pending','Provider review','Transport provider'],
 ['Accepted','Quotation','Transport provider'],
 ['Quotation Submitted','School review','School / approver'],
 ['Approved','Transport setup','Transport provider'],
 ['Confirmed','Trip operation','Transport provider'],
 ['Completed','Completed','No outstanding action'],
];
export function WorkflowRail({steps,current}) {
 return <ol style={{"--workflow-columns":steps.length}} className="td-workflow-rail" aria-label="Workflow stages">{steps.map((step,i)=><li key={step} className={i===current?'is-current':i<current?'is-past':''} aria-current={i===current?'step':undefined}><span className="td-workflow-mark">{i<current?<FiCheck/>:i===current?<FiClock/>:i+1}</span><span><strong>{step}</strong><small>{i===current?'Current stage':i<current?'Earlier stage':'Next stage'}</small></span>{i<steps.length-1&&<FiArrowRight className="td-workflow-arrow" aria-hidden="true"/>}</li>)}</ol>
}
export default function LiveTripWorkflow({trip,permissions=[],actions,compact=false}) {
 const attention=getTripAttention(trip,permissions),index=phases.findIndex(p=>p[0]===trip.status),closed=['Rejected','Cancelled','Canceled'].includes(trip.status),cancel=Boolean(trip.cancelRequest)||trip.status==='Cancel Requested';
 const owner=cancel?'Transport provider':index>=0?phases[index][2]:'See current action';
 return <section className={`td-live-workflow ${compact?'is-compact':''}`} aria-label="Live trip workflow"><header><div><span className="td-workflow-kicker">LIVE WORKFLOW</span><h3>{closed?'Workflow closed':cancel?'Cancellation awaiting decision':index>=0?phases[index][1]:'Current workflow'}</h3></div><span className="td-workflow-owner">{index===5?'Completed':'Responsibility: '+owner}</span></header>{!closed&&index>=0&&<WorkflowRail steps={phases.map(p=>p[1])} current={index}/>}<div className={`td-workflow-focus ${cancel?'is-exception':''}`}><div><span className="td-workflow-kicker">{closed?'CLOSED':cancel?'EXCEPTION · CANCELLATION':attention.tone==='action'?'YOUR ACTION':attention.tone==='waiting'?'WAITING ON OTHERS':'CURRENT POSITION'}</span><h4>{attention.title}</h4><p>{attention.detail}</p>{!closed&&index>=0&&index<5&&!cancel&&<p className="td-workflow-next">Next: {phases[index+1][1]}</p>}</div>{actions&&<div className="td-workflow-actions">{actions}</div>}</div><p className="td-workflow-footnote">Current position comes from the trip record. Earlier stages show the workflow path, not an activity history.</p></section>
}
