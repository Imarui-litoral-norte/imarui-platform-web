const MODE_LABELS = {
  login: "acesso",
  register: "cadastro",
  "register-service": "integração",
  "forgot-password": "recuperacao",
  "forgot-password-reset": "nova senha",
};

import { useAuthFormStore } from "@/features/auth/store/useAuthFormStore";
import { Heading, PageTitle, Text } from "@/shared/ui/typography";

export default function AuthFormHeader() {
  
  const mode = useAuthFormStore((state) => state.content?.mode);
  const title = useAuthFormStore((state) => state.content?.formTitle);
  const description = useAuthFormStore((state) => state.content?.formDescription);

  return (
    <div className="space-y-3">
      <Text variant="eyebrow" className="inline-flex rounded-full bg-[var(--accent-soft)] px-3 py-1">
        {MODE_LABELS[mode]}
      </Text>
      <PageTitle  className="text-slate-950">
        {title}
      </PageTitle>
      {description ? <Text className="text-sm leading-6 text-slate-600">{description}</Text> : null}
    </div>
  );
}
