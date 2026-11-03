export async function readWizardList(response: Response): Promise<unknown[]> {
 if(!response.ok)throw new Error('This list is unavailable in the current test mode.');
 const value:unknown=await response.json();
 if(!Array.isArray(value))throw new Error('The list response was invalid.');
 return value;
}
