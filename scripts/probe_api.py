"""Bounded API probe. Secrets stay in-process; only allowlisted metrics are printed.

Reads credentials from .env without invoking a shell or loading harness secrets.
Does not print response text, reasoning, headers, error bodies, or credentials.
No automatic retries or endpoint fallback. At most two requests per invocation.
"""

import argparse
from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
import re
import time
from urllib.error import HTTPError, URLError
from urllib.request import HTTPRedirectHandler, Request, build_opener


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def load_key():
    values = {}
    for raw in Path('.env').read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith('#'):
            continue
        if line.startswith('export '):
            line = line[7:].lstrip()
        name, sep, value = line.partition('=')
        if not sep:
            continue
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        else:
            value = re.split(r'\s+#', value, maxsplit=1)[0].strip()
        values[name.strip()] = value
    for name in ('ZAI_API_KEY', 'Z_AI_API_KEY', 'ZHIPU_API_KEY', 'GLM_API_KEY',
                 'ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_API_KEY', 'API_KEY',
                 'OPENAI_API_KEY'):
        if values.get(name):
            return values[name]
    candidates = [v for k, v in values.items()
                  if v and re.search(r'(?i)(api.?key|auth.?token)$', k)]
    if len(candidates) == 1:
        return candidates[0]
    raise ValueError('credential_configuration')


def probe(key, transport, model, case, max_output_tokens):
    prompts = {
        'connectivity': ('Follow the short output instruction.', 'Return exactly OK.'),
        'speak': (
            'I am Mara, a pilgrim praying beside a quiet brazier. I speak only as '
            'myself. I hear the conversation by default. When I have something '
            'to say I output {"action":"speak","text":"my spoken words"}. '
            'Otherwise I output {"action":"no_response"}. I output only JSON.',
            'The others pause and I offer one personal prayer of at most 15 words.'),
        'no_response': (
            'I am Iven, a quiet pilgrim. Mara is speaking. I have nothing to add '
            'and do not speak. I hear the conversation by default. My output is '
            '{"action":"no_response"} '
            'or {"action":"speak","text":"my spoken words"}. I output only JSON.',
            'Mara: May those lost on the mountain find shelter tonight.'),
    }
    system, prompt = prompts[case]
    payload = {'model': model, 'max_tokens': max_output_tokens, 'stream': False,
               'messages': [{'role': 'user', 'content': prompt}]}
    headers = {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key}
    if transport == 'anthropic':
        url = 'https://api.z.ai/api/anthropic/v1/messages'
        headers['anthropic-version'] = '2023-06-01'
        payload['system'] = system
    else:
        url = 'https://api.z.ai/api/coding/paas/v4/chat/completions'
        payload['messages'].insert(0, {'role': 'system', 'content': system})
        if case != 'connectivity':
            payload['response_format'] = {'type': 'json_object'}
    started = time.monotonic()
    result = {'case': case, 'transport': transport}
    try:
        req = Request(url, data=json.dumps(payload).encode(), headers=headers, method='POST')
        with build_opener(NoRedirect).open(req, timeout=45) as response:
            result['http_status'] = response.status
            body = response.read(2_000_000)
        data = json.loads(body)
        if transport == 'anthropic':
            content = ''.join(b.get('text', '') for b in data.get('content', [])
                              if b.get('type') == 'text')
            finish = data.get('stop_reason')
        else:
            choice = data.get('choices', [{}])[0]
            content = choice.get('message', {}).get('content') or ''
            finish = choice.get('finish_reason')
        result['has_visible_text'] = bool(content.strip())
        result['visible_characters'] = len(content)
        if finish in ('end_turn', 'stop', 'length', 'max_tokens', 'stop_sequence'):
            result['finish_reason'] = finish
        result['expected_ok'] = content.strip() == 'OK' if case == 'connectivity' else None
        if case != 'connectivity':
            try:
                decision = json.loads(content)
                action = decision.get('action')
                result['valid_decision'] = action in ('no_response', 'speak')
                result['expected_action'] = action == ('speak' if case == 'speak' else 'no_response')
                if action == 'speak':
                    result['within_word_limit'] = isinstance(decision.get('text'), str) and len(decision['text'].split()) <= 15
            except (ValueError, TypeError, AttributeError):
                result['valid_decision'] = False
        usage = data.get('usage', {})
        result['usage'] = {k: v for k, v in usage.items()
                           if k in ('input_tokens', 'output_tokens', 'prompt_tokens',
                                    'completion_tokens', 'total_tokens')
                           and isinstance(v, int)}
    except HTTPError as error:
        result['http_status'] = error.code
        try:
            data = json.loads(error.read(100_000))
            code = data.get('error', {}).get('code')
            if isinstance(code, int) or (isinstance(code, str) and code.isdigit()):
                result['provider_error_code'] = code
        except (ValueError, AttributeError, TypeError):
            pass
    except URLError as error:
        result['failure'] = 'network_or_tls'
        result['reason_type'] = type(error.reason).__name__
        errno = getattr(error.reason, 'errno', None)
        if isinstance(errno, int):
            result['network_errno'] = errno
    except TimeoutError:
        result['failure'] = 'timeout'
    except Exception:
        result['failure'] = 'response_or_configuration'
    result['elapsed_seconds'] = round(time.monotonic() - started, 3)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--transport', choices=('anthropic', 'openai'), default='openai')
    parser.add_argument('--model', choices=('glm-5.3', 'glm-5.3-flash'), default='glm-5.3')
    parser.add_argument('--max-output-tokens', type=int, choices=(512, 1024, 2048, 4096), default=2048)
    parser.add_argument('--behavior', action='store_true', help='Two concurrent, short speak/no_response requests.')
    args = parser.parse_args()
    try:
        key = load_key()
    except Exception:
        print(json.dumps({'failure': 'credential_configuration'}))
        return
    cases = ['speak', 'no_response'] if args.behavior else ['connectivity']
    with ThreadPoolExecutor(max_workers=len(cases)) as pool:
        results = list(pool.map(lambda case: probe(key, args.transport, args.model, case, args.max_output_tokens), cases))
    print(json.dumps({'results': results}, indent=2))


if __name__ == '__main__':
    main()
