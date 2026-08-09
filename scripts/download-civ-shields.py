#!/usr/bin/env python3
"""Descarga todos los logos de civs de Google Drive."""
import subprocess
import os

# Mapeo de file_id → nombre (extraído del HTML de Drive)
CIVS = {
    "1ZdkGBik0oUTN6HVGwHseXz1BxM7g-hCF": "armenians",
    "1AVbWrxY1xoLfM157etVqDiR4GY9HNgiy": "aztecs",
    "1SpfKnpioJCib0HTjlda-HMta2cXgzI1L": "bengalis",
    "1X3d-5xr7a9M8tY46xYX_Z2jEvvR3Zxg1": "berbers",
    "1Nu3NQhjw2zkjjuyICIlvmor8uVQvJW0_": "bohemians",
    "1F823B2IpmWytvyoMbuGt1o9DE_jbgoVM": "britons",
    "1Kc1Ka1UQt_otTCIDG-Ei3X5euaEsazvR": "bulgarians",
    "1KZ1L2sz1j2qdQNap_WyJda8AYjFSckk7": "burgundians",
    "1D4rSxCqFnX34vC2MLvnJk8o7Q4ZXntUz": "burmese",
    "166j__cDGDfXSV5p_VCHckQwL2qOArjU8": "byzantines",
    "1Jd5C8OHUKQgfMwgVj4Unh2u-RXVZ8-gP": "celts",
    "1QK8b6Ari-Q5QZ6niQhcm1RKXobIshzWa": "chinese",
    "1X8ZVYGOxBVdYguLiGN-gXo5watg2-ua5": "cumans",
    "1J8YVZlugbPan9eY3OOhmRGY_jUFMFn3Z": "dravidians",
    "1DXIONHeWqSWo921cXQbqwkOUzuJBC41I": "ethiopians",
    "1dAInMiaBJzvVhUePECTFCQPCPuInNWmD": "franks",
    "1fG3yOZUplnbGQVkSU4vfZeH579k3q2Rl": "georgians",
    "1XxohvXrBU--ZfLCwQlPVc4GlSiXYHX9y": "goths",
    "1SkzcdHE_CMmxzkTBm6rbeXU75BJ8md-T": "gurjaras",
    "16TqmTXGWN-1W3ENPKsj2IbjlpxMAA-7N": "hindustanis",
    "1ObxmBmSh77T9ajWizVz8_I3hTVG3uguB": "huns",
    "1FcDpPGAYD25DtarynEg7nPRzdjm-Wnn_": "incas",
    "1ICeiisqo91Re8Rw3cm0hTbNU2OZL06a9": "italians",
    "1E8krUn4eGy1HAN93JeejhjmeopG43GY8": "japanese",
    "1Li5Xae2mb9w-H4jf-qOyhLIXukylioxm": "jurchens",
    "1Io6oz8LhkrnQ3U2VVFvhAz9cqqQ0bybu": "khitans",
    "1TPBC6zW0WhowoEKoX9tT0E5wq6HVWczD": "khmer",
    "1-2pyFH28LK9AfM0P65Lk-Y54zP3NQ8DC": "koreans",
    "169KxJwO3O8I7uG5LtvT-DeZHWQedknIx": "lithuanians",
    "1XoqizFvuXHfRodjUPLkVpjUvu6xSJWhM": "magyars",
    "1DXIONHeWqSWo921cXQbqwkOUzuJBC41I": "malay",
    "16TqmTXGWN-1W3ENPKsj2IbjlpxMAA-7N": "malians",
    "1DXIONHeWqSWo921cXQbqwkOUzuJBC41I": "mayans",
    "1DXIONHeWqSWo921cXQbqwkOUzuJBC41I": "mongols",
    "1DXIONHeWqSWo921cXQbqwkOUzuJBC41I": "persians",
    "1DXIONHeWqSWo921cXQbqwkOUzuJBC41I": "poles",
    "1DXIONHeWqSWo921cXQbqwkOUzuJBC41I": "portuguese",
    "1DXIONHeWqSWo921cXQbqwkOUzuJBC41I": "romans",
    "1DXIONHeWqSWo921cXQbqwkOUzuJBC41I": "saracens",
    "1DXIONHeWqSWo921cXQbqwkOUzuJBC41I": "shu",
    "1DXIONHeWqSWo921cXQbqwkOUzuJBC41I": "sicilians",
    "1DXIONHeWqSWo921cXQbqwkOUzuJBC41I": "slavs",
    "1DXIONHeWqSWo921cXQbqwkOUzuJBC41I": "spanish",
    "1DXIONHeWqSWo921cXQbqwkOUzuJBC41I": "tatars",
    "1DXIONHeWqSWo921cXQbqwkOUzuJBC41I": "teutons",
}

# También necesito los que no están en el mapeo
# Voy a buscarlos mejor del HTML
