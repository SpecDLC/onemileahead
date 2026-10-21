// Minimal flat config for ESLint 10 (issue #9, OMA-TECH-BUILD-2): typescript-eslint's recommended
// rules plus the React hooks rules. `npm run lint` lints src/.
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  { ignores: ['dist/', 'coverage/', 'dev-dist/'] },
  tseslint.configs.recommended,
  reactHooks.configs.flat.recommended,
);
