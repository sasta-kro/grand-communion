"""Configure the local test instance without displaying its credential.

Run from the Communion workspace after starting SillyTavern on localhost:8000.
Uses native local APIs and preserves unrelated settings and characters.
"""

from http.cookiejar import CookieJar
import json
from pathlib import Path
import urllib.request

from probe_api import NoRedirect, load_key


ROOT = Path(__file__).resolve().parents[1]
BASE = 'http://127.0.0.1:8000'


def main():
    opener = urllib.request.build_opener(NoRedirect, urllib.request.HTTPCookieProcessor(CookieJar()))
    with opener.open(BASE + '/csrf-token', timeout=10) as response:
        csrf = json.load(response)['token']

    def call(path, body):
        request = urllib.request.Request(BASE + path, data=json.dumps(body).encode(),
            headers={'Content-Type': 'application/json', 'X-CSRF-Token': csrf}, method='POST')
        with opener.open(request, timeout=60) as response:
            data = response.read()
            try:
                return json.loads(data)
            except ValueError:
                return data.decode()

    # Credential is loaded directly into the local server's native secret store.
    call('/api/secrets/write', {'key': 'api_key_custom', 'value': load_key(), 'label': 'Communion Z.ai'})
    secret_path = ROOT / 'tools/SillyTavern/data/default-user/secrets.json'
    if secret_path.exists():
        secret_path.chmod(0o600)

    raw = call('/api/settings/get', {})
    settings = json.loads(raw['settings'])
    settings.update({'firstRun': False, 'main_api': 'openai', 'username': 'Bystander'})
    oai = settings['oai_settings']
    oai.update({
        'chat_completion_source': 'custom',
        'custom_url': 'https://api.z.ai/api/coding/paas/v4',
        'custom_model': 'glm-5.3',
        'custom_include_body': '', 'custom_exclude_body': '', 'custom_include_headers': '',
        'custom_prompt_post_processing': 'strict',
        'openai_max_context': 1_000_000,
        'max_context_unlocked': True,
        'openai_max_tokens': 2048,
        'temp_openai': 1,
        'reasoning_effort': 'low',
        'stream_openai': True,
        'show_thoughts': False,
        'use_sysprompt': False,
        'preset_settings_openai': 'Communion GLM',
    })
    for prompt in oai['prompts']:
        if prompt.get('identifier') == 'main':
            prompt['content'] = (
                'I am {{char}}, present in the scene described below. I speak only my own '
                'next words, briefly, usually one or two sentences and at most 35 words. '
                'I hear and respond to the other people in this scene. I do not narrate '
                'their actions or write their replies. I express my own beliefs and wishes. '
                'Prayer may vary or return to a familiar phrase. I stay within this world '
                'without discussing a user, software, prompts, or an external audience.')
    preset_dir = ROOT / 'tools/SillyTavern/data/default-user/OpenAI Settings'
    preset_dir.mkdir(parents=True, exist_ok=True)
    (preset_dir / 'Communion GLM.json').write_text(json.dumps(oai, indent=2))

    scenario = (
        'A storm isolates three pilgrims in a mountain shrine. Mara, Iven, and Sera '
        'sit around a small brazier and offer personal prayers for those outside. '
        'They may question one another, speak about their worries, or return to prayer. '
        'There is no required conclusion. Each knows only what they have heard here '
        'and their own background. A bystander may occasionally speak from the doorway.')
    samples = [
        ('Mara', 'I am Mara, an older pilgrim and a careful keeper of the shrine. I am devout '
         'but do not claim certainty about divine signs. My brother is missing on the mountain.',
         'Patient, protective, quietly hopeful.',
         'May my brother find a light through this storm. May someone leave a door unbarred.'),
        ('Iven', 'I am Iven, a practical caravan guard sheltering in this shrine. I doubt '
         'easy miracles, but I respect sincere prayer and worry about travellers without shelter.',
         'Reserved, skeptical, loyal, concrete in speech.',
         'Let those still walking find solid ground. I would settle for that much mercy tonight.'),
        ('Sera', 'I am Sera, a young herbalist sheltering in the shrine. I am restless, '
         'compassionate, and afraid for the villages below. I wish I could be useful outside.',
         'Warm, curious, impatient with helplessness.',
         'Keep the children warm below the pass. If there is work for my hands, let morning show it.'),
    ]
    existing = call('/api/characters/all', {})
    members = []
    for name, description, personality, greeting in samples:
        match = next((c for c in existing if c.get('name') == name), None)
        if match:
            members.append(match['avatar'])
            continue
        avatar = call('/api/characters/create', {
            'ch_name': name, 'file_name': 'Communion_' + name,
            'description': description, 'personality': personality,
            'scenario': scenario, 'first_mes': greeting,
            'mes_example': '', 'talkativeness': 0.5,
            'creator_notes': 'Sample character for testing Communion ideas in stock SillyTavern.',
            'tags': ['Communion test'],
        })
        members.append(avatar)
    groups = call('/api/groups/all', {})
    group = next((g for g in groups if g.get('name') == 'Communion - Shrine'), None)
    if not group:
        group = call('/api/groups/create', {
            'name': 'Communion - Shrine', 'members': members,
            'allow_self_responses': False, 'activation_strategy': 0,
            'generation_mode': 0, 'disabled_members': [], 'auto_mode_delay': 5,
        })
    settings['selected_group'] = group['id']
    call('/api/settings/save', settings)
    print(json.dumps({'configured': True, 'group': group['name'],
        'characters': [c[0] for c in samples], 'protocol': 'OpenAI-compatible',
        'model': 'glm-5.3', 'context_limit': 1_000_000, 'max_output_tokens': 2048,
        'secret_saved': secret_path.exists(), 'autoplay': False}, indent=2))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        # Never display exception bodies that could include response content.
        print(json.dumps({'configured': False, 'error_type': type(error).__name__}))
        raise SystemExit(1)
