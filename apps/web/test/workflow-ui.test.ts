import * as React from 'react';
Object.assign(globalThis,{React});
import {test} from 'node:test';import assert from 'node:assert/strict';import {createElement} from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {TripModal} from '../src/components/Trips/TripModal/TripModal';import {TripsTable} from '../src/components/Trips/TripsTable';
test('original editor renders a stored online TEST request without a browser or service call',()=>{
 const client=new QueryClient({defaultOptions:{queries:{enabled:false,retry:false}}});
 try{const trip={id:1,client_id:1,booking_number:'TEST-1',start_time:'2026-11-10T14:50:00Z',status:'needs_review',notes:'TEST ONLY',pickup_address:'A',dropoff_address:'B',services:[{service_id:1,service_price:84,duration_minutes:75,quantity:1}]};
 const html=renderToStaticMarkup(createElement(QueryClientProvider,{client},createElement(TripModal,{trip,prefillData:null,clients:[{id:1,name:'Test Rider'}],drivers:[],services:[{id:1,name:'Test service',default_price:84}],preselectedDriverId:null,onClose:()=>{},onSuccess:()=>{},onBookReturn:()=>{}})));
 assert.ok(html.includes('TEST'));assert.ok(html.includes('Save'));
 }finally{client.clear();}
});
test('database table Edit works only for TEST rows and financial/destructive controls stay disabled',()=>{
 const html=renderToStaticMarkup(createElement(TripsTable,{trips:[{id:1,booking_number:'TEST-1',status:'needs_review',client_name:'Test Rider'}],databaseReview:true,sampleMode:true,isLoading:false,error:null,onEdit:()=>{},onDelete:()=>{},onInvoice:()=>{},onPay:()=>{},onSendThankYou:null,onPageChange:()=>{}}));
 const buttons=[...html.matchAll(/<button([^>]*)>([\s\S]*?)<\/button>/g)];
 const edit=buttons.find(b=>/>Edit|\sEdit/.test(b[2]));assert.ok(edit);assert.doesNotMatch(edit[1],/disabled/);
 for(const label of ['Pay','Invoice','Delete']){const button=buttons.find(b=>b[2].includes(label));assert.ok(button);assert.match(button[1],/disabled/);}
});

import {createMemoryRouter,RouterProvider} from 'react-router';
import {TripListView} from '../app/preview/trip-list-view';
test('standalone review and trip pages contain only one original table and no diagnostic dumps',()=>{
 for(const status of ['', 'needs_review']){
 const data={trips:[{id:1,booking_number:'TEST-1',status:'needs_review',start_time:'2026-11-10T14:50:00Z',client_name:'Test Rider'}],page:2,hasMore:true,search:'Test',testsOnly:true,status,settings:{business_name:'MUST NOT DISPLAY'}};
 const router=createMemoryRouter([{path:'/',element:createElement(TripListView,{data,onEdit:()=>{},onAssign:()=>{},onDecide:()=>{}})}]);
 try{const html=renderToStaticMarkup(createElement(RouterProvider,{router}));assert.equal((html.match(/<table\b/g)||[]).length,1);assert.doesNotMatch(html,/<ul\b|Imported business settings|MUST NOT DISPLAY|Customer online booking \(test\)|Database bookings/);assert(html.includes(status?'Review Orders':'All Trips'));assert(html.includes('Assign Driver'));assert.equal(html.includes('>Approve</button>'),!!status);assert(html.includes('Previous page'));assert(html.includes('Next page'));}finally{router.dispose();}
 }
});

import {PageWithBackButton} from '../src/components/PageWithBackButton';
test('original page back control uses canonical database dashboard',()=>{const html=renderToStaticMarkup(createElement(PageWithBackButton,{},'Settings'));assert.match(html,/href="\/preview\/database"/);assert(html.includes('Back to Dashboard'));});
