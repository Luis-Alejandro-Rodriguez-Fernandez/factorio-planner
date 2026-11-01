#!/usr/bin/env python3
"""
Genera src/core/gamedata.js a partir de los datos oficiales de Factorio (https://github.com/wube/factorio-data):
los edificios colocables con su tamaño, las categorías de fabricación de cada máquina y las recetas con sus categorías.

    git clone --depth 1 https://github.com/wube/factorio-data /tmp/factorio-data
    python3 -I scripts/extract-factorio-data.py /tmp/factorio-data > src/core/gamedata.js

No ejecuta Lua: lee las tablas literales de los prototipos y repite a mano lo poco que el juego genera con código
(las recetas de barriles y las categorías que Space Age añade con add_recipe_category).
"""
import json, math, os, re, sys

# ---------- lector de tablas Lua ----------
TOK = re.compile(r'''
 (?P<ws>\s+)|(?P<lc>--\[(?P<e1>=*)\[.*?\](?P=e1)\])|(?P<c>--[^\n]*)|
 (?P<ls>\[(?P<e2>=*)\[.*?\](?P=e2)\])|
 (?P<s>"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|
 (?P<n>0x[0-9a-fA-F]+|\d+\.?\d*(?:[eE][-+]?\d+)?|\.\d+)|
 (?P<id>[A-Za-z_][A-Za-z0-9_]*)|
 (?P<op>\.\.\.|\.\.|==|~=|<=|>=|//|::|[-+*/%^#<>=(){}\[\];:,.])''', re.S | re.X)

class Raw:
    def __init__(self, t): self.t = t

def lex(src):
    out, i = [], 0
    while i < len(src):
        m = TOK.match(src, i)
        if not m: i += 1; continue
        i = m.end()
        if m.group('ws') or m.group('lc') or m.group('c'): continue
        if m.group('ls'): out.append(('s', m.group('ls')))
        elif m.group('s'): out.append(('s', m.group('s')[1:-1]))
        elif m.group('n'): out.append(('n', m.group('n')))
        elif m.group('id'): out.append(('id', m.group('id')))
        else: out.append(('op', m.group('op')))
    return out

class Parser:
    def __init__(self, toks): self.t, self.i, self.tables = toks, 0, []
    def peek(self, o=0): return self.t[self.i + o] if self.i + o < len(self.t) else ('eof', '')
    def table(self):
        self.i += 1; d, arr = {}, []
        while self.peek()[1] != '}' and self.peek()[0] != 'eof':
            a, b = self.peek(), self.peek(1)
            if a[0] == 'id' and b == ('op', '='): self.i += 2; d[a[1]] = self.expr()
            elif a == ('op', '['): self.i += 1; k = self.expr(); self.i += 2; d[str(k)] = self.expr()
            else: arr.append(self.expr())
            if self.peek()[1] in (',', ';'): self.i += 1
        self.i += 1
        if arr: d['__arr'] = arr
        self.tables.append(d); return d
    def skip_group(self):
        self.i += 1; depth = 1
        while depth and self.peek()[0] != 'eof':
            u = self.peek()
            if u == ('op', '{'): self.table(); continue
            if u[0] == 'op' and u[1] in '([': depth += 1
            elif u[0] == 'op' and u[1] in ')]': depth -= 1
            self.i += 1
    def skip_function(self):
        self.i += 1; depth = 1
        while depth and self.peek()[0] != 'eof':
            u = self.peek()
            if u == ('op', '{'): self.table(); continue
            if u[0] == 'id' and u[1] in ('function', 'if', 'do'): depth += 1
            elif u[0] == 'id' and u[1] == 'end': depth -= 1
            elif u[0] == 'id' and u[1] in ('for', 'while'): depth -= 1   # su «do» suma después
            self.i += 1
    def expr(self):
        parts = []
        while True:
            t = self.peek()
            if t[0] == 'eof' or (t[0] == 'op' and t[1] in (',', ';', '}', ')', ']')): break
            if t == ('op', '{'): v = self.table()
            elif t[0] == 'op' and t[1] in '([': self.skip_group(); v = Raw(t[1])
            elif t == ('id', 'function'): self.skip_function(); v = Raw('function')
            else:
                self.i += 1
                if t[0] == 's': v = t[1]
                elif t[0] == 'n' and not t[1].startswith('0x'): v = float(t[1])
                elif t[0] == 'id' and t[1] in ('true', 'false'): v = t[1] == 'true'
                else: v = Raw(t[1])
            parts.append(v)
        if len(parts) == 1: return parts[0]
        if len(parts) == 2 and isinstance(parts[0], Raw) and parts[0].t == '-' and isinstance(parts[1], float): return -parts[1]
        return Raw('expr')

def lua_tables(path):
    src = open(path, encoding='utf-8', errors='ignore').read()
    p = Parser(lex(src))
    while p.i < len(p.t):
        if p.peek() == ('op', '{'): p.table()
        else: p.i += 1
    return p.tables, src

# ---------- prototipos ----------
MODS = ['base', 'elevated-rails', 'quality', 'space-age', 'recycler']
def load(root):
    protos, srcs = [], []
    for mod in MODS:
        for dp, _, fn in os.walk(os.path.join(root, mod)):
            for f in sorted(fn):
                if not f.endswith('.lua'): continue
                tabs, src = lua_tables(os.path.join(dp, f)); srcs.append(src)
                for t in tabs:
                    if isinstance(t.get('type'), str) and isinstance(t.get('name'), str): t['__mod'] = mod; protos.append(t)
    return protos, srcs

arr = lambda v: [x for x in v.get('__arr', [])] if isinstance(v, dict) else []
strs = lambda v: [x for x in arr(v) if isinstance(x, str)]

def box_size(cb):
    try:
        (a, b) = arr(cb); x0, y0 = arr(a); x1, y1 = arr(b)
        return [max(1, math.ceil(x1 - x0 - 0.01)), max(1, math.ceil(y1 - y0 - 0.01))]
    except Exception: return None

def main(root):
    protos, srcs = load(root)
    # los ingredientes y productos de las recetas también son tablas con type y name: solo cuentan los prototipos de verdad
    real = {'item': 'stack_size', 'item-with-entity-data': 'stack_size', 'rail-planner': 'stack_size', 'fluid': 'default_temperature'}
    by_type = {}
    for p in protos:
        if p['type'] in real and real[p['type']] not in p: continue
        by_type.setdefault(p['type'], {}).setdefault(p['name'], p)
    ITEM_TYPES = ('item', 'item-with-entity-data', 'rail-planner')
    items = {}
    for t in ITEM_TYPES:
        for n, p in by_type.get(t, {}).items(): items.setdefault(n, p)
    ents = {}
    for p in protos:
        if p['type'] not in ITEM_TYPES + ('recipe', 'tile', 'fluid') and 'collision_box' in p: ents.setdefault(p['name'], p)

    # edificios colocables con su tamaño en casillas (tile_width/height si los hay; si no, la caja de colisión)
    buildings = {}
    placed = []
    for it in items.values():
        if isinstance(it.get('place_result'), str): placed.append((it, it['place_result']))
        for r in strs(it.get('rails')): placed.append((it, r))
    for it, pr in placed:
        e = ents.get(pr)
        if e is None or pr in buildings: continue   # el primer objeto que lo coloca (la rampa también lista las vías rectas)
        size = [int(e['tile_width']), int(e['tile_height'])] if isinstance(e.get('tile_width'), float) and isinstance(e.get('tile_height'), float) else box_size(e.get('collision_box'))
        if not size: continue
        if 'placeable-off-grid' in strs(e.get('flags')) and e['type'] in ('car', 'spider-vehicle'): size = None
        buildings[pr] = {'size': size, 'type': e['type'], 'hidden': bool(it.get('hidden')), 'mod': it['__mod'], 'item': it['name']}

    # máquinas con receta (las de horno eligen la receta solas y no la guardan en el plano)
    machines = {}
    for t in ('assembling-machine', 'rocket-silo'):
        for n, p in by_type.get(t, {}).items():
            cats = strs(p.get('crafting_categories'))
            if cats: machines[n] = cats

    # recetas y sus categorías
    recipes = {}
    for n, r in by_type.get('recipe', {}).items():
        if r.get('parameter') or r.get('hidden'): continue
        cats = strs(r.get('categories')) or ([r['category']] if isinstance(r.get('category'), str) else ['crafting'])
        res = [x for x in arr(r.get('results')) if isinstance(x, dict)]
        main_name = r.get('main_product') if isinstance(r.get('main_product'), str) else (res[0].get('name') if len(res) == 1 and isinstance(res[0].get('name'), str) else None)
        recipes[n] = {'cats': cats, 'mod': r['__mod'], 'subgroup': r.get('subgroup') if isinstance(r.get('subgroup'), str) else None, 'order': r.get('order') if isinstance(r.get('order'), str) else None, 'main': main_name}
    # recetas de barriles que base/data-updates.lua genera para cada fluido sin auto_barrel = false
    for n, f in by_type.get('fluid', {}).items():
        if f.get('auto_barrel') is False or f.get('parameter') or f.get('hidden'): continue
        for rn, sg in ((n + '-barrel', 'fill-barrel'), ('empty-' + n + '-barrel', 'empty-barrel')):
            recipes.setdefault(rn, {'cats': ['crafting-with-fluid'], 'mod': f['__mod'], 'subgroup': sg, 'order': None, 'main': None})
    # categorías que Space Age añade a recetas de la base
    for src in srcs:
        for m in re.finditer(r'add_recipe_category\(\s*data\.raw\.recipe(?:\[\s*"([^"]+)"\s*\]|\.([A-Za-z_][\w]*))\s*,\s*"([^"]+)"\s*\)', src):
            r = recipes.get(m.group(1) or m.group(2))
            if r and m.group(3) not in r['cats']: r['cats'].append(m.group(3))

    # orden de la Factoriopedia: grupo, subgrupo, orden de la receta (o de su producto) y nombre
    sub = by_type.get('item-subgroup', {}); grp = by_type.get('item-group', {})
    anyitem = {}   # objetos de cualquier tipo (munición, módulos, armaduras, paquetes de ciencia…) para ordenar
    for p in protos:
        if 'stack_size' in p: anyitem.setdefault(p['name'], p)
    def key(n):
        r = recipes[n]; it = anyitem.get(r['main'] or n) or by_type.get('fluid', {}).get(r['main'] or n) or {}
        sg = r['subgroup'] or (it.get('subgroup') if isinstance(it.get('subgroup'), str) else 'other')
        s = sub.get(sg, {}); g = grp.get(s.get('group'), {})
        o = r['order'] or (it.get('order') if isinstance(it.get('order'), str) else '') or ''
        return (str(g.get('order', 'z')), str(s.get('order', 'z')), o, n)
    usable = {c for cs in machines.values() for c in cs}
    order = sorted((n for n, r in recipes.items() if any(c in usable for c in r['cats'])), key=key)

    ver = json.load(open(os.path.join(root, 'base', 'info.json')))['version']
    mods = {'base': 0, 'elevated-rails': 1, 'quality': 1, 'space-age': 1, 'recycler': 1}
    out = []
    out.append('// Generado por scripts/extract-factorio-data.py a partir de wube/factorio-data %s. No editar a mano.' % ver)
    out.append('export const GAME_VERSION = %s;' % json.dumps(ver))
    out.append('/** Categorías de fabricación de cada máquina que guarda la receta en el plano. */')
    out.append('export const MACHINE_CATS = %s;' % json.dumps(machines, separators=(',', ':')))
    out.append('/** Recetas en el orden de la Factoriopedia: [nombre, categorías, 1 si es de Space Age]. */')
    out.append('export const RECIPE_LIST = [')
    for n in order: out.append('  %s,' % json.dumps([n, recipes[n]['cats'], mods[recipes[n]['mod']]], separators=(',', ':')))
    out.append('];')
    out.append('/** Edificios colocables: tamaño en casillas (null si se coloca libremente), 1 si está oculto en partidas normales, 1 si es de Space Age. */')
    out.append('export const BUILDINGS = {')
    for n in sorted(buildings): b = buildings[n]; out.append('  %s: %s,' % (json.dumps(n), json.dumps([b['size'], int(b['hidden']), mods[b['mod']]], separators=(',', ':'))))
    out.append('};')
    print('\n'.join(out))

if __name__ == '__main__':
    main(sys.argv[1])
