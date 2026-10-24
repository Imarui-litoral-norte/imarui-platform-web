import { authApi } from "@/features/auth/lib/authApi";
import { documentDigits, isValidDocument } from "@/features/auth/lib/document";
function resultOf(result) {
  return {ok:true,resetForm:true,message:"Solicitação enviada. Aguarde a aprovação e o convite para definir sua senha.",
    result:{title:"Solicitação de acesso",items:[{label:"Protocolo",value:result.id},{label:"Situação",value:result.status}]}};
}
export async function registerService(payload) {
  if(!isValidDocument(payload.document))throw new Error("Informe um CPF ou CNPJ válido.");
  const document=documentDigits(payload.document),legal=document.length===14;
  const body={name:String(payload.name||"").trim(),document,nickname:String(payload.nickname||"").trim(),email:String(payload.email||"").trim()};
  if(legal)body.tradeName=String(payload.tradeName||"").trim()||null;
  else {body.birthDate=payload.birthDate||null;body.phoneNumber=String(payload.phoneNumber||"").trim()||null;}
  return resultOf(await authApi.register(body));
}
export async function registerTechnicalService(payload) {
  return resultOf(await authApi.registerService({name:String(payload.name||"").trim(),nickname:String(payload.nickname||"").trim(),
    email:String(payload.email||"").trim(),description:String(payload.description||"").trim()||null}));
}
