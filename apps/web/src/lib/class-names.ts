export function classNames(...candidates: Array<string | false | null | undefined>): string {
  return candidates.filter((candidate): candidate is string => Boolean(candidate)).join(' ');
}
