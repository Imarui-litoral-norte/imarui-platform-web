import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

const sourceExtensions = "**/*.{js,jsx,ts,tsx}";
const featureSlices = [
  "iam",
  "auth",
  "authorization",
  "critica-pedidos",
  "dpo",
  "extrator-manager",
  "server-manager",
  "spo",
  "receivables",
];

const temporaryAuthConsumers = new Set(["authorization", "dpo"]);

function restrictImports(regex, message) {
  return [
    "error",
    {
      patterns: [{ regex, message }],
    },
  ];
}

const featureIsolationConfigs = featureSlices.map((slice) => {
  const allowsAuthRoot = temporaryAuthConsumers.has(slice);
  const externalFeaturePattern = allowsAuthRoot
    ? `^@/features/(?!${slice}(?:/|$)|auth$)[^/]+(?:/|$)`
    : `^@/features/(?!${slice}(?:/|$))[^/]+(?:/|$)`;

  return {
    files: [`src/features/${slice}/${sourceExtensions}`],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: "^@/(?:widgets|views|app)(?:/|$)",
              message: "Features nao podem depender de widgets, views ou app.",
            },
            {
              regex: externalFeaturePattern,
              message: allowsAuthRoot
                ? "Esta feature so pode importar outra feature pela excecao temporaria @/features/auth, sem modulos internos."
                : "Features irmas nao podem depender umas das outras, inclusive pela API publica.",
            },
          ],
        },
      ],
    },
  };
});

const eslintConfig = defineConfig([
  ...nextVitals,
  {
    files: [`src/shared/${sourceExtensions}`],
    rules: {
      "no-restricted-imports": restrictImports(
        "^@/(?:features|widgets|views|app)(?:/|$)",
        "Shared nao pode depender de camadas superiores.",
      ),
    },
  },
  {
    files: [`src/entities/${sourceExtensions}`],
    rules: {
      "no-restricted-imports": restrictImports(
        "^@/(?:features|widgets|views|app)(?:/|$)",
        "Entities pode depender somente de shared.",
      ),
    },
  },
  {
    files: [`src/features/${sourceExtensions}`],
    rules: {
      "no-restricted-imports": restrictImports(
        "^@/(?:widgets|views|app)(?:/|$)",
        "Features nao podem depender de widgets, views ou app.",
      ),
    },
  },
  ...featureIsolationConfigs,
  {
    files: [`src/widgets/${sourceExtensions}`],
    rules: {
      "no-restricted-imports": restrictImports(
        "^@/(?:views|app)(?:/|$)",
        "Widgets nao podem depender de views ou app.",
      ),
    },
  },
  {
    files: [`src/views/${sourceExtensions}`],
    rules: {
      "no-restricted-imports": restrictImports(
        "^@/app(?:/|$)",
        "Views nao podem depender de app.",
      ),
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
