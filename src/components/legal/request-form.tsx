'use client';

import { CheckCircle2, Send } from 'lucide-react';
import { useState, type FormEvent } from 'react';

export function RequestForm({ type }: { type: 'contact' | 'takedown' }) {
  const [state,setState]=useState<'idle'|'busy'|'sent'>('idle');const[error,setError]=useState('');
  const submit=async(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();setState('busy');setError('');const form=event.currentTarget;const data=Object.fromEntries(new FormData(form));try{const response=await fetch(type==='contact'?'/api/contact':'/api/takedown',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)});const body=await response.json();if(!response.ok)throw new Error(body.error?.message||'The request could not be sent');form.reset();setState('sent')}catch(reason){setError(reason instanceof Error?reason.message:'The request could not be sent');setState('idle')}};
  if(state==='sent')return <div className="request-success"><CheckCircle2/><h2>Request received</h2><p>{type==='takedown'?'The notice is now in the legal review queue. Keep your reference for follow-up.':'The CineSeya.lk team has received your message.'}</p><button onClick={()=>setState('idle')}>Send another</button></div>;
  return <form className="request-form" onSubmit={submit}><div className="form-two"><label>Full name<input name="requester" minLength={2} maxLength={100} required autoComplete="name"/></label><label>Email address<input name="email" type="email" required autoComplete="email"/></label></div>{type==='takedown'&&<label>Content URL<input name="contentUrl" type="url" required placeholder="https://cineseya.lk/movies/…"/></label>}<label>{type==='takedown'?'Reason and rights basis':'How can we help?'}<textarea name={type==='takedown'?'reason':'message'} minLength={20} maxLength={4000} rows={7} required/></label><label className="honeypot" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off"/></label>{error&&<p className="form-error" role="alert">{error}</p>}<button className="action-button" disabled={state==='busy'}><Send/>{state==='busy'?'Sending…':'Submit request'}</button></form>;
}
