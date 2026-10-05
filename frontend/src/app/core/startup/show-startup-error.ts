// Angular is unavailable if bootstrap fails; use a small native fallback.
export function showStartupError(
  page: Document = document,
  reload: () => void = () => window.location.reload(),
): void {
  const host = page.querySelector('app-root');
  if (!host) return;
  const french = page.location.pathname.startsWith('/fr/');
  const message = page.createElement('p');
  message.textContent = french
    ? 'TypeDash n’a pas pu démarrer. Rechargez la page pour réessayer.'
    : 'TypeDash could not start. Reload the page to try again.';
  message.setAttribute('role', 'alert');
  const retry = page.createElement('button');
  retry.type = 'button';
  retry.textContent = french ? 'Recharger la page' : 'Reload page';
  retry.addEventListener('click', reload);
  host.classList.add('startup-error');
  host.replaceChildren(message, retry);
}
