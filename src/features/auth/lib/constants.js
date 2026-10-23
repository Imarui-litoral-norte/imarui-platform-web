import { AUTH_FORM_MODES } from "@/features/auth/types";
import { APP_ROUTES } from "@/shared/config/routes";

const CONTENT = {
  login: {
    mode: AUTH_FORM_MODES.LOGIN,
    footer: "portal de acesso logimarui",
    formTitle: "Entrar na plataforma",
    submitLabel: "Entrar",
    successPrefix: "Sessao iniciada com sucesso.",
    secondaryLink: {
      label: "Precisa de acesso ao ambiente?",
      cta: "Cadastrar usuario",
      href: APP_ROUTES.REGISTER,
    },
    auxiliaryLinks: [{ label: "Recuperar senha", href: APP_ROUTES.FORGOT_PASSWORD }],
    fields: [
      {
        name: "cpf",
        label: "CPF",
        type: "text",
        inputMode: "numeric",
        placeholder: "000.000.000-00",
        autoComplete: "username",
        maxLength: 14,
        format: "cpf",
        required: true,
        validation: { isCpf: true, allowTestValue: "cpf" },
      },
      {
        name: "password",
        label: "Senha",
        type: "password",
        placeholder: "Digite sua senha",
        autoComplete: "current-password",
        required: true,
        validation: { minLength: 8, allowTestValue: "password" },
      },
    ],
  },
  register: {
    mode: AUTH_FORM_MODES.REGISTER,
    footer: "portal de acesso logimarui",
    formTitle: "Cadastrar novo usuario",
    submitLabel: "Cadastrar",
    successPrefix: "Cadastro concluido com sucesso.",
    secondaryLink: {
      label: "Ja possui acesso?",
      cta: "Voltar para login",
      href: APP_ROUTES.LOGIN,
    },
    auxiliaryLinks: [
      { label: "Esqueci minha senha", href: APP_ROUTES.FORGOT_PASSWORD },
    ],
    fields: [
      {
        name: "cpf",
        label: "CPF",
        type: "text",
        inputMode: "numeric",
        placeholder: "000.000.000-00",
        autoComplete: "username",
        maxLength: 14,
        format: "cpf",
        required: true,
        validation: { isCpf: true },
      },
      {
        name: "name",
        label: "Nome completo",
        type: "text",
        placeholder: "Nome completo do usuario",
        autoComplete: "name",
        required: true,
        validation: { minLength: 3 },
      },
      {
        name: "email",
        label: "E-mail",
        type: "email",
        placeholder: "usuario@empresa.com",
        autoComplete: "email",
        required: false,
        validation: { isEmail: true },
      },
      {
        name: "phoneNumber",
        label: "Telefone",
        type: "tel",
        placeholder: "(00) 00000-0000",
        autoComplete: "tel",
        required: false,
      },
      {
        name: "password",
        label: "Senha",
        type: "password",
        placeholder: "Crie uma senha",
        autoComplete: "new-password",
        required: true,
        validation: { minLength: 8 },
      },
      {
        name: "confirmPassword",
        label: "Confirmar senha",
        type: "password",
        placeholder: "Repita a senha",
        autoComplete: "new-password",
        required: true,
        validation: { matchesField: "password" },
      },
    ],
  },
  forgotPassword: {
    mode: AUTH_FORM_MODES.FORGOT_PASSWORD,
    footer: "portal de acesso logimarui",
    formTitle: "Iniciar recuperação de senha",
    formDescription:
      "Informe o CPF do usuario e escolha se o processo deve apenas abrir a solicitacao ou disparar o link por e-mail.",
    submitLabel: "Registrar recovery",
    helperText:
      "O envio por e-mail depende de um endereco ja cadastrado para o usuario. Sem isso, use apenas o registro da solicitacao.",
    successPrefix: "Solicitacao registrada com sucesso.",
    secondaryLink: {
      label: "Lembrou da senha?",
      cta: "Voltar para login",
      href: APP_ROUTES.LOGIN,
    },
    auxiliaryLinks: [{ label: "Criar conta", href: APP_ROUTES.REGISTER }],
    fields: [
      {
        name: "cpf",
        label: "CPF",
        type: "text",
        inputMode: "numeric",
        placeholder: "000.000.000-00",
        autoComplete: "username",
        maxLength: 14,
        format: "cpf",
        required: true,
        validation: { isCpf: true },
      },
      {
        name: "sendEmailToken",
        label: "Envia-me um link de recuperação por e-mail",
        type: "checkbox",
        hint: "Ative para realizar a recuperação usando seu e-mail cadastrado.",
        defaultValue: false,
      },
    ],
  },
  passwordRecoveryReset: {
    mode: AUTH_FORM_MODES.PASSWORD_RECOVERY_RESET,
    footer: "portal de acesso logimarui",
    formTitle: "Definir nova senha",
    formDescription:
      "Informe a nova senha para concluir a redefinicao ou a troca obrigatoria exigida no login.",
    submitLabel: "Salvar nova senha",
    helperText:
      "Esta tela depende do token presente na URL atual. Se o link estiver incompleto ou expirado, o backend recusara a operacao.",
    successPrefix: "Senha atualizada com sucesso.",
    secondaryLink: {
      label: "Voltar sem alterar agora?",
      cta: "Ir para login",
      href: APP_ROUTES.LOGIN,
    },
    auxiliaryLinks: [{ label: "Criar conta", href: APP_ROUTES.REGISTER }],
    fields: [
      {
        name: "password",
        label: "Nova senha",
        type: "password",
        placeholder: "Digite a nova senha",
        hint: "Use uma senha com no minimo 8 caracteres.",
        autoComplete: "new-password",
        required: true,
        validation: { minLength: 8 },
      },
      {
        name: "confirmPassword",
        label: "Confirmar nova senha",
        type: "password",
        placeholder: "Repita a nova senha",
        hint: "Repita a senha para confirmar a alteracao.",
        autoComplete: "new-password",
        required: true,
        validation: { matchesField: "password" },
      },
    ],
  },
};

const identityKind = { name: "identityKind", label: "Tipo de identidade", type: "select", defaultValue: "PERSON", required: true,
  options: [{value:"PERSON",label:"Pessoa"},{value:"LEGAL_ENTITY",label:"Pessoa jurídica"},{value:"SERVICE",label:"Serviço"}] };
const identifier = { name: "identifier", label: "Apelido ou documento", type: "text", autoComplete: "username", required: true, maxLength: 100,
  placeholder: "Apelido, CPF ou CNPJ", hint: "E-mail é contato e não é usado como identificação de acesso." };
export const AUTH_PAGE_CONTENT = {
  ...CONTENT,
  login: { ...CONTENT.login, fields: [identityKind, identifier,
    {name:"password",label:"Senha",type:"password",autoComplete:"current-password",required:true}],
    secondaryLink: {...CONTENT.login.secondaryLink, cta:"Solicitar acesso"} },
  register: { ...CONTENT.register, formTitle:"Solicitar acesso", submitLabel:"Enviar solicitação",
    formDescription:"O cadastro depende de aprovação, classificação e convite de primeiro acesso.",
    fields: [
      {name:"nickname",label:"Apelido de acesso",type:"text",required:true,maxLength:64,validation:{minLength:3}},
      ...CONTENT.register.fields.filter(field => !["password","confirmPassword"].includes(field.name)).map(field => field.name === "email" ? {...field,required:true} : field)
    ] },
  forgotPassword: { ...CONTENT.forgotPassword, formTitle:"Recuperar acesso", submitLabel:"Solicitar recuperação",
    formDescription:"Informe o tipo e a identificação da conta. As instruções seguem para o contato cadastrado, quando aplicável.",
    helperText:"A resposta não informa se uma conta existe.",fields:[identityKind,identifier] },
  passwordRecoveryReset: { ...CONTENT.passwordRecoveryReset,
    formDescription:"Defina a senha usando o convite de primeiro acesso ou o link de recuperação recebido.",
    helperText:"Use pelo menos 12 caracteres e no máximo 72 bytes UTF-8.",
    fields:CONTENT.passwordRecoveryReset.fields.map(field => field.name === "password"
      ? {...field,hint:"Mínimo de 12 caracteres; máximo de 72 bytes UTF-8.",validation:{minLength:12,maxUtf8Bytes:72}} : field) }
};
