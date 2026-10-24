import { isValidCpf } from "./cpf";
export const documentDigits = value => String(value || "").replace(/\D/g, "");
export function isValidCnpj(value) {
  const digits=documentDigits(value);
  if(digits.length!==14 || /^(\d)\1+$/.test(digits))return false;
  for(const size of [12,13]) {
    let sum=0,weight=size-7;
    for(let i=0;i<size;i++){sum+=Number(digits[i])*weight;weight=weight===2?9:weight-1;}
    const mod=sum%11;if(Number(digits[size])!==(mod<2?0:11-mod))return false;
  }
  return true;
}
export const isValidDocument=value=>isValidCpf(value)||isValidCnpj(value);
export function visibleAuthFields(fields,values) {
  const legal=documentDigits(values.document).length===14;
  return fields.filter(field=>!field.documentKind || (field.documentKind==="legal"?legal:!legal));
}
