export default function AuthInput({
  label,
  name,
  type = "text",
  placeholder,
  value,
  hint,
  error,
  autoComplete,
  inputMode,
  maxLength,
  required = false,
  onChange,
  options = [],
}) {
  const inputId = `auth-${name}`;
  const descriptionId = `${inputId}-description`;
  if (type === "select") return (
    <label className="block"><span className="mb-2 block text-sm font-medium text-slate-800">{label}</span>
      <select id={inputId} name={name} value={value} onChange={onChange} required={required}
        className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-slate-900">
        {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>{error ? <span role="alert" className="text-sm text-rose-600">{error}</span> : null}
    </label>
  );

  if (type === "hidden") {
    return (
      <input
        id={inputId}
        name={name}
        type="hidden"
        value={value}
        onChange={onChange}
      />
    );
  }

  if (type === "checkbox") {
    return (
      <label className="block">
        <span className="flex items-start gap-3 rounded-2xl border border-black/10 bg-white px-4 py-3">
          <input
            id={inputId}
            className="mt-0.5 h-4 w-4 rounded border border-black/20 text-slate-950 outline-none"
            name={name}
            type="checkbox"
            checked={Boolean(value)}
            required={required}
            aria-invalid={Boolean(error)}
            aria-describedby={hint || error ? descriptionId : undefined}
            onChange={onChange}
          />

          <span className="min-w-0">
            <span className="block text-sm font-medium text-slate-800">
              {label}
              {required ? <span className="ml-1 text-rose-600">*</span> : null}
            </span>
            <span
              id={descriptionId}
              role={error ? "alert" : undefined}
              className={`mt-2 block text-xs leading-6 ${
                error ? "text-rose-600" : "text-slate-500"
              }`}
            >
              {error || hint}
            </span>
          </span>
        </span>
      </label>
    );
  }

  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-800">
        {label}
        {required ? <span className="ml-1 text-rose-600">*</span> : null}
      </span>

      <input
        id={inputId}
        className={`w-full rounded-2xl border px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 ${
          error
            ? "border-rose-300 bg-rose-50"
            : "border-black/10 bg-white focus:border-[var(--accent)] focus:bg-[var(--panel)]"
        }`}
        name={name}
        type={type}
        placeholder={placeholder}
        value={value}
        autoComplete={autoComplete}
        inputMode={inputMode}
        maxLength={maxLength}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={hint || error ? descriptionId : undefined}
        onChange={onChange}
      />

      <span
        id={descriptionId}
        role={error ? "alert" : undefined}
        className={`mt-2 block text-xs leading-6 ${
          error ? "text-rose-600" : "text-slate-500"
        }`}
      >
        {error || hint}
      </span>
    </label>
  );
}
