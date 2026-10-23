import AuthInput from "@/features/auth/components/AuthInput";
import { useAuthFormStore } from "@/features/auth/store/useAuthFormStore";

export default function AuthFields() {
  const errors = useAuthFormStore((state) => state.errors);
  const fields = useAuthFormStore((state) => state.content?.fields ?? []);
  const handleChange = useAuthFormStore((state) => state.handleChange);
  const values = useAuthFormStore((state) => state.values);

  return fields.map((field) => (
    <AuthInput
      key={field.name}
      label={field.label}
      name={field.name}
      type={field.type}
      options={field.options}
      placeholder={field.placeholder}
      value={values[field.name] ?? ""}
      hint={field.hint}
      error={errors[field.name]}
      autoComplete={field.autoComplete}
      inputMode={field.inputMode}
      maxLength={field.maxLength}
      required={field.required}
      onChange={handleChange}
    />
  ));
}
