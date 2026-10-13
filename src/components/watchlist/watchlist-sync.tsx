'use client';

import { useEffect } from 'react';
import { readCsrfToken, readMigratedStorage, WATCHLIST_CHANGE_EVENT, WATCHLIST_STORAGE_KEY } from '@/lib/client/browser-brand';
const KEY=WATCHLIST_STORAGE_KEY;
const csrf=readCsrfToken;
export function WatchlistSync({authenticated}:{authenticated:boolean}){useEffect(()=>{document.documentElement.dataset.authenticated=authenticated?'true':'false';if(!authenticated)return;const local=JSON.parse(readMigratedStorage(KEY)||'[]') as Array<{id:string;type:'movie'|'series'}>;fetch('/api/watchlist',{method:'POST',headers:{'Content-Type':'application/json','x-csrf-token':csrf()},body:JSON.stringify({items:local.map((item)=>({contentType:item.type,contentId:item.id}))})}).then(async(response)=>response.ok?response.json():null).then((result)=>{if(!result)return;localStorage.setItem(KEY,JSON.stringify(result.items));dispatchEvent(new CustomEvent(WATCHLIST_CHANGE_EVENT));}).catch(()=>undefined);return()=>{delete document.documentElement.dataset.authenticated;};},[authenticated]);return null;}
