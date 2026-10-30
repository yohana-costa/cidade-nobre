"""Regera todos os assets a partir das 4 telas em referencias/.
Uso (na raiz do projeto):  python3 ferramentas/assets/extrair_todos.py
Depois rode  python3 build.py  para atualizar os HTMLs em dist/.
"""
import pathlib, runpy

HERE = pathlib.Path(__file__).resolve().parent
for step in ['crest.py', 'lockup.py', 'heroes.py', 'recortes.py']:
    print(f'> {step}')
    runpy.run_path(str(HERE / step), run_name='__main__')
print('Assets atualizados em assets/. Máscaras de conferência em build/debug/.')
