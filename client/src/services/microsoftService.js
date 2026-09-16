// client/src/services/microsoftService.js
import { msalInstance } from "../auth/msal.js";
import api from "./apiClient.js";
function apiScope(){const configured=String(import.meta.env.VITE_MS_API_SCOPE||"").trim();if(!configured)throw new Error("Microsoft integration is not configured");return configured;}
async function acquireMicrosoftApiToken(){const accounts=msalInstance.getAllAccounts(),account=msalInstance.getActiveAccount()||accounts[0];if(!account)throw new Error("Connect your Microsoft 365 account first");const request={account,scopes:[apiScope()]};try{return(await msalInstance.acquireTokenSilent(request)).accessToken}catch{return(await msalInstance.acquireTokenPopup(request)).accessToken}}
async function microsoftRequest(config){const microsoftAccessToken=await acquireMicrosoftApiToken();return api.request({...config,headers:{...(config.headers||{}),"X-Microsoft-Access-Token":microsoftAccessToken}})}
export function hasConnectedMicrosoftAccount(){return Boolean(msalInstance.getActiveAccount()||msalInstance.getAllAccounts()[0]);}
export async function getMicrosoftProfile(){return(await microsoftRequest({method:"get",url:"/ms/me"})).data;}
export async function sendMicrosoftMail(payload){return(await microsoftRequest({method:"post",url:"/ms/sendMail",data:payload})).data;}
export async function createMicrosoftEvent(payload){return(await microsoftRequest({method:"post",url:"/ms/events",data:payload})).data;}
export async function sendQuotationApprovalViaOutlook({schoolId,tripId,approverEmail,participantOrganizationId=null}){return(await microsoftRequest({method:"post",url:"/ms/workflow/quotation-approval",data:{schoolId,tripId,approverEmail,participantOrganizationId}})).data;}
