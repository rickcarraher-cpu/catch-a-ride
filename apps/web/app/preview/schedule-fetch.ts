// Original print message modal cannot perform external sends in test mode.
export async function scheduleFetch(_input:string,_init:RequestInit={}):Promise<Response>{
 throw new Error('Customer/driver sending is disabled in this test. No message sent.');
}
