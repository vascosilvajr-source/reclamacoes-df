import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { dbStorage } from "./supabaseClient";
import { Plus, X, Check, AlertTriangle, Clock, Search, Trash2, Pencil, ShieldAlert, LayoutGrid, BarChart3, Inbox, Play, ClipboardList, Scale, Mail, Sparkles, Users } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  ReferenceLine,
  AreaChart,
  Area,
} from "recharts";

// ---------- Tokens ----------
// ---------- Sistema de cores: tema claro e escuro ----------
// COLORS mantém o mesmo nome e chaves de sempre, mas os valores passam a ser
// substituídos conforme o tema. Como todos os componentes leem COLORS no
// momento em que renderizam, trocar o tema basta para tudo acompanhar.
const TEMA_CLARO = {
  ink: "#0E1420",
  ink2: "#48536B",
  paper: "#F2F2F7",
  paperRaised: "#FFFFFF",
  paperSunken: "#F7F7FA",
  rule: "#E6E8EC",
  ruleSoft: "#F0F1F4",
  navy: "#0A52C7",
  navySoft: "#0A52C7",
  navyWash: "#EAF1FD",
  slate: "#8A93A5",
  ok: "#0C7A52",
  okBg: "#E6F4EE",
  warn: "#9A6A00",
  warnBg: "#FBF2DE",
  danger: "#C0303F",
  dangerBg: "#FCEAEC",
  done: "#8A93A5",
  doneBg: "#F0F1F4",
  progress: "#0A52C7",
  progressBg: "#EAF1FD",
  purple: "#6B4C9A",
  purpleBg: "#F1EBF8",
  sideBg: "#FFFFFF",
  onAccent: "#FFFFFF",
  shadow: "0 1px 2px rgba(14,20,32,0.05)",
  // Materiais translúcidos: fundo, bordo e brilho superior (reflexo especular).
  segTrack: "#EFEFF4",
  lift: "0 8px 24px -12px rgba(14,20,32,0.18)",
};

const TEMA_ESCURO = {
  ink: "#E7ECF3",
  ink2: "#A7B2C2",
  paper: "#000000",
  paperRaised: "#1C1C1E",
  paperSunken: "#2C2C2E",
  rule: "#38383A",
  ruleSoft: "#2C2C2E",
  navy: "#528CFF",
  navySoft: "#8AB4FF",
  navyWash: "#15243C",
  slate: "#6F7C8E",
  ok: "#2BBE87",
  okBg: "#10281F",
  warn: "#E0A63A",
  warnBg: "#2A2113",
  danger: "#F2697C",
  dangerBg: "#2E1720",
  done: "#6F7C8E",
  doneBg: "#1B232D",
  progress: "#528CFF",
  progressBg: "#15243C",
  purple: "#A98AD8",
  purpleBg: "#221B33",
  sideBg: "#1C1C1E",
  onAccent: "#08131F",
  shadow: "0 1px 2px rgba(0,0,0,0.5)",
  segTrack: "#2C2C2E",
  lift: "0 10px 28px -14px rgba(0,0,0,0.7)",
};

const COLORS = { ...TEMA_CLARO };

const APP_NAME = "Auditoria e Gestão de Qualidade DF";

// Logótipo Dragon Force em versão monocromática branca, para a barra escura.
const LOGO_BRANCO = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAL0AAADkCAYAAADNViUPAAAgt0lEQVR4nO2dd7gcVdnAfzch5YYkkJBQAgQIEIggBCGU0KuioChV4RNULIh0RBH9RLEQQVSwICJFUFSQT4oUIQKChUiTRJpCKAkJJJACIQlJ7vv98e56987OKbM7s7Mze37PM8/dO3Nmztndd8+88563dIkIgUIwHNgH+H3O4yg8XUHoC8VdwHPAp/MeSJFZLe8BBBJxIjADWAqcmu9Qiku/vAcQSMQzwOXAKcCHcx5LYQlCXzx+X/k7BRid4zgKSxD64vEvYBGwIfDZnMdSSILQF4/ZwLzK648Cq+c4lkIShL6YvFH5Ow7YPc+BFJEg9MkYAnwN2CjncXTVvN4nt1EUlGCyTMaNwKvACzmPY3jN6+1yG0VBCULvz4XAXsDmOY9jPWBEzf9533UKR1Bv/JgMnAHcAbyU81g2oK/QD4v8H3AQhN6PMyt/H8x1FMo7I//3r2wBT4LQu9kSeG/l9ew8B1JhcuT/t4EVeQykqAShd7M/MKjyenmeA6mwW+T/RZXNxJWoShSoEITezS41r4fkNgplV2CLyD6bJekkYDwwK7MRFZAg9G7G1bxeL7dRKB+M2fdPS/tPAU9mNJbCEoTezRo1ryfkNgp1N/hAzP6/GtqPBbYGlmU2ooIShN5N7We0TW6jgAOBzSL75mO2KK1d+btJZiMqKEHolT2AbsOxt2peb0G9Tt0qjovZ9xC6QmxjJ3p/AAGC0Fc5HPVYjGNOzetBwN7ZD6eOcehqcBSTagP6Y1gCrIX5vXUkQeiVacAJhmMzIv/H6dVZsxvxLsSPWM55EXiq8vpLwDvSHlRRCUKvvAlsS7z++5fI/3vSehVnUsy+FWiQuI0bKn9HAL+kr6NaxxKEXqkKcVz43YPA6zX/dwNHNtHX0dQ/kLqI+zEupjeYxMRVNW0mAv+bsN9SEoReqaoscea9ucCjkX1HNdjP1cCPgaR5V+Jm6LdwmyPnomlDqhwLrJuw79IRhB4+AuyMPrC+aGgzLfL/BOrdAVzciD5QngQ8m/DcOPeHAfg5mj1c83oUIdKqNELfjVopkrI1cEnl9b3AQkO76TH7dk7Qz2XoaupfgV8kOK9KnKPbCPxm7ZWR/7duoP9SURah3xK1VHyLZA9rlwAjK68vtbR7OWbfeM8+Pgd8svL6hzX7twA29bzG32P2DUJt8C6ibdb07LO0lEXoH0VjV89GzXj7epyzH72278eBP1vaLonZ5/Pjegfwzcrrl4Dba47tXun3AI/r/JHeYPBaXClAJgOHRfa96dFfqSmL0IPOot9CZ8+7UNu0jf1qXrt07DjvyjghjPJVen8cf6Kv+nQ5cB9wJ/WCGeU54PqY/TuhFpqhMccOAH4LDIzs/7ejr9JTJqEHOAe1q3ehM+zFlrYb17weaWpUIc7R7KmYfbVsBxxa83/cneTLqCXnV6jfvo0pxPvNH4suoF2CqlJfAKYCtwHrR9ouA/7m6Kf8iEjZtt1FpEd6ucDQ7tc1bd4WkUmWa94jfVklIu9yjOP8yDk7Gtr9pnL8ZREZ57jmKdIctzmuH91WF5GvisjUyuu8v9tUttwHkNF2vfTluJg2UaF8WkS2jWn3dannDo8xTKtpv0TMAv3emnY3e1z3rpjx+NAjInt7XL+67SP6mYjEf36F3XIfQEbbvtKXuSKyQaTNgVLPEtGZ9wuiP4qHY9qsEpE9HP2PrPRZZamIbGZoO1xEXqxpe6Tj2juJyIqYcbkw3fHitv+V3rvlSQnOK8SW+wAy3J6Uvpwf02aGJMdHeNYTkcWR82yz7A017aZ5XP8nCcd8rcc1q9vPa877bYLzCrOV7UG2lqij2KHU+8yfl/CaT3mes4r6RSGbS3Ktt+Qk1KnNxgXYg8FruRU4xrPtz4GPV14vQE3ApaPMQv+fyP/jqPeO/A3wvQTX/Brq6OViOX2DT0B99k2BKjMj/7ts98+hFh8X/6ZXiF2cHWn7E5K7SxSCMgv9qsj//YAxMe1OR4XfxT3Arz37XkS90G8JHGFoHx3rRI8+rvJocwpuT0zQu8u5Nf+/ga4jlJIyC/2GMftMq6ifAO53XO+ihP3HOYl9nviFrmg+Sp80fdOwZ0K4nr4rwDbOpu8i1t3U331KQ5mFPi6b76CYfaBuBkcBTxuOT0d14yT0xOzbCv2BRdk18n905jdhSzPoO1OPR4POa7nT89xCUlah34R4obcla3oZXdGMI+pa7MMAw/5T0KSrVTah/iHX1z/mCcP+mdjjZ2uZDAyO7HvG89xCUlahP4D4mFKXu8HdwGMx+338bKL9mPraFDik5v/jqVe7fC0zcw37H8X/hxPn6VnqXDllFfpDDPt9csDMj9m3ZsL+twHWsRx/f+XvWOILIftYiMD8Y3ze83yIf2+lrlpYRqFfD7Of+bsc5w4lPn41abWPjzmOV/NjnkJ88ItvFuK45wZIVmwj7jmn1NVNyij0kzBbP7bDvvBzKH29L6tsC7zPs/99cC8GrYc+0B5tOG564I4S9aKskiTwPO45J4/cPi2j3YV+FJq64jT8I6Jcqfe+S/zt+0DsZsmLMAtZlXHAz3B/rv2A8zFnHrOpRrWYZuRt8VfJ4iaISfRNXOvLOsA36A3BbEvaXejno0J0BmpOPNTeHIi3z9eyPRp+dwZwMBp9dDtwC/YH3fGon7qpmt9+6IOwr7CMom+VwFq2Ij4wJIopOH19+qYYtxGXiXkI8B7P86uchFqNDkJXc9uWLpGk2ShyYWM0ymgs8B00UMLElcTnfUyLHjSH5AOomXN1VGXak3TL4ByD3uVM7IZ9Qe0mzA/0VTZDF7jiVJw7qLffx7E6ujp8GDqZ7E+7hyTm7fGWYDuoxvvvR5Z2U6QczBKR8WJ+n7d4XOMsy/mIyJWWc18VkdGO8xENTBEReUNEtvJon/vW7upNLbcC/6i8/iy9xc+itEMxtDRYH1WX4nJnXoiqES6mANdQr3LtgM7kx1nOHY07W8NP6b0b3AT8y2NMuVMU9abKBfQK+1I0o8DDkTZroTGjZcrkNQNVHZajacWjFQZdvIlOGK+iP4CJmFeMazkM+J3lWG2w+sdR1bLtKVrx5NqZpBv1DDw40uY14DrU4lMWtqa5JE1DacwMabKYdaOZHmopTJmfIqk30DdXPOgtPs5KcSnt/jBVDJYa9h9B3x/hMnSyKQRFE/qFMfviFoKewW75CLgRzF6n/xP5fxnxCbHakqIJfZwj1AHERyRdhr+LbqCe6dRnawY1H0fdPFZSoALORRP6HurTXG+GRiVFeQR3YEjAjCkccQfqF86E5OnHc6NoQm9awTSVlrkjq4GUnCXEpxEEdXGIYvpe2pKiCX0/4j9g09L/Y9kNpdQ8grm0T5wzWxcFkqXCDLRCNBlpFZOD1itZDaTk2PJ0jorZ158Cmb+LJvSmcD9T+fqivb92wWaJifusV8NvsastKJpQmPzMTf7jZVqVbSVrGPZvQny8QRD6DDHdQrcg3oITaqc2hulz25f42ON+pOthmilFE3pTwPIg6hdMoG/hhYA/O1IfYTYEc7aIYKfPkFcwLzidTl//8XdXtkByuoAr6C1jtA7qTBZnrgQNUF/QgnGlQtG8LIejTmcbGI6vRIM75qIrta6UHwE7q4BZ6Oduy7r2AAUq1VkYM1OFxegHbCpevBq9xdMCzdOf+pSDcUzNeiBpUjT1BjQoItA+LEMLuhWGIgr9bRRsZik5V2NOL9iWFE2nrzIJrdYXzcEYaC0vopXTo3EObU0RZ3rQ0LdSVskoED3AiRRM4KG4Qg/wfTRAOpAPZ5I8fXlbUGShBy1yMCXvQXQgXyJZ2aK2oqg6fZRT0Vm/MEvhBeY09C5bWMoi9KBB4teQPK12wI9laJqP6/IeSLOUSehB88HcSLKsvQE3i4EjKUkkWtmEHjTf5S24sxcH/FiAZlkrTbxxGYUeVPD/hDstXcDOW6jaeE/eA0mToltvTLyI1nIyVeoI+HEyJRN4KK/QA9yLX1HkQDy3AT/PexBZUGahB/h93gMoMG1dWKEZyi70s/MeQEFZTInTp5Rd6MNiVWO8TYlryZZd6AuVeavNKO1nV3ahL/v7CzRA2YWitLNVoHHKLvSBQB1lF/ow0wfqCEIf6DjKLvRlf3+BBghCEYij1HfIsgt9qb+8QGMEoQ90HGUX+rK/v0ADlF0owkwfqKPsQl/29xdogLILRdnfX5aU9i5ZdqEo7RcXaJyyC33Z31+gAcouFGV/f4EGKLtQBPUmUEfZhb7s7y/QAGUXipV5D6Cg9GCu4lh4yi70b+Q9gIKytLKVkrIL/by8B1BQXkNT+pWSsgv9XApU1LeNmJX3ALKk7EI/B81rGUjG9LwHkCVlF3qAh/MeQAH5e94DyJJOEPq78h5AwXgdmJb3ILKkE4T+HvTBLODHvcAreQ8iSzpB6F8Bbs57EAXimrwHkDVlrUQSZUfgb3TGj7wZHgG2z3sQWdMpQjCNElTFawHfyXsAraBTZnqAzYEHgRF5D6RNuR14b96DaAWdMtMD/Bs4J+9BtCmvA6fnPYhW0UlCD1pS5tq8B9GGnAw8lfcgWkWnCT3ACcADeQ+ijTgX+GXeg2glnaTT17IuqsNOzHkceXMJOst3FJ0404M6or0PeCjvgeTIRXSgwEPnCj3Ay8D+wB/yHkgOfBE4I+9B5EUnCz3AQrQM/PdyHkerWAgcBkzJeRy50qk6fRwfBn5Eee3404Bj6SArjYlOn+lruQ6YBEzNeyApswqd2XciCDwQhD7Ks8B+wKlo1eyiMwPYG9XhAxWCemNmM9TCcXDeA2mApcAF6Axf2ljXRglC7+Yw1BFrk7wH4skfUcvMjLwH0q4E9cbNDegi1rdp77QYM4GjgHcTBN5KmOmTMQFVGdpJ5XkLVcMuoBzPIZkThL4xDkaFf0LO47gROBt4JudxFIog9I3TDZyCWkbWaHHf/wI+j/oPBRIShL55NkYfdA9vQV+L0WeL81vQV2kJQp8eB6G69eYZXf9mNNDj2Yyu3zEE60163Aq8C/gu6WZLfhl1kfgAQeBTIcz02bArcCmwdZPX+RU6u5c6D02rCTN9NvwF2BkN0miE14GjK1sQ+JQJM332HAJcBoz2bH8/cBzwXEbj6XjCTJ89v0c9HH2Sov4A2IMg8JkShL41zAR2Aa4yHH8b+ATq3RnImCD0reVjaPaBWuYDBwJXtHw0HUrQ6fPhBODHwGzUpeHRfIfTWQShz49jgKeBf+Q9kE4jCH2g4wg6faDjCEIf6DiC0Ac6jiD0gY4jCH2g4whCH+g4gtAHOo4g9IGOIwh9oONYDdgOGA8MBnoSni9o3pVXgRcrWxK6gfc32He1/6Wo09Zs4D8NXMOHD6IZD1ZZ2vSvjOPWlPueDOwObAOMBdYEBqLvfSWwHFhS6XseGl74PPBCZZvZYL+j0ECYXYAtgfWBocAA9LtahlZifxb1HfoLMD1hH+OB3YAVljYD0fq2SfyTPgQMp/77Wg2Yg4h8S0Rel+ZZIiIzROQSEdlJRPDY1hGR11LoW0RkuYg8KyLXishBnv37bFuJyNueY1gkImNT6HO4iJwhIk8l/xj6sExE/iMi4xP0PVFErpTk38tKEZkmIscn6OvTnteeluCa3SIy03KtB/qhs4VtBvNlCLAV8Dk0YOJm3JkBpLKlwUBgHBpidwtaMzaN6tf7o7ObD8PRLMHNsDfwMHAhsEWT1xoErI1fOsIhaHGKf6CRWyMT9tUfTXX+M3TG39XjHF+5m4RGoPlik6lVWer0B6PCv2+GfdjYEbgPeE+T10laUPh9TfR1BHAnmjE5LV4BXnK0GVXp91RUBWiWrYF7UE/StDglrQtl/SA7kt4EqHmwOhqt1GjG4Q3QUL8k7E7yWRJUd78K/7uKL7M82vwW1a3TZABwNenl/dwLTU7bNK2w3qxJvjWd1qHxogS7oypLEtZFHwCTchH6YJ82LziOf43mVTIT/YAfot9BGpyaxkVaZbLcCzigRX3FcQiq2yalUVXlwITtP0TyO4ovtgRRY4GTMuq3to8TU7rWe9DA+abw0d8ErbD9Jr0/EkFvXyNR/XOYx3UORgsGJGF5pe8VQFfkWBdqQtsMt0CvjWYfuyNB32tg/oCrptrVDcf3S9APqC7vYjmqd/8ZNRGDPqgORb+HEcBa6Kw6Cn3P62I3WR6Gu7BcD1qH6yY0O/Ib6He/LqqSHQms57jGh9H8m2lURTkJ/QwaR0S+LiLzLCaeFSKyucVENEZEvudhdro/5ty1RWS+5Zw5IjLS0nfVvHeuR/+nOa4T3d5tudZSEZkiIj2WNrsk6Os/jrHPF5E9E45/DRGZICIjLG1ud/S7TESOcvQzWkTudlxHJP7zON7jvCgrRGR7y3i6ReQ5y/n3+ao3/S3HXgZOA651XGNNz75qic7ucSxGMwy4ZvExCfu2WW3mANegmchM+FqNNsSt834BtUQlYRHwJLDAcLwbt0n5G8CvHW3moaU6X3W0SyuX/2o0Wek8TZ3+Vy3sKw6XUAxOeD2bivIIWuLGVubGV+iHoTZyEwuB2zyvlYSh2FWbt1HLmw+zgbscbdJ6mAVVB7dq9OQ0BXEW9sWGrCPQFzmO+9w1qkwC3mE5Xq01e6+lzXb4zW79sY9tLnpnSZt+2L//BQn7dWVlS8P+X2UwTTwcpyn0K2nMf6ZVJPnR7W85thLNNwm6AGNiALBPgj5NLE/hGo3QQ7LPzPXdJ530etC7jYmjaXD9JU2hTzKTtju2RZAn6FVrHsO++JN0NbfdSPKdpv39LwOutxwfjibNSkyZXItdH7rvl7IpsIPleK25bBHq42NiF5I/QAeUIcB1wD8tbT6Gen8mokxCv5bjuK/qtQ/2B8upjv9rGQHs6dlvoJ5ZwMWW46OATya9aJmE3rUg9KbndWyrsAuon9kfwP4A34wDWqczBE1sa1tV/gQq/N6UQeg3RJOhupanfYIp1sbuEvsI9RaN6ag93MSetL7kZlmoWnxsFV02QNcJEl+0XRmJLr2vJF4nHwZshNkdoJbHPNrshn3WMKkyD2CuL1X11EzqgpGUA9H6VFHf+WrMxEm4XYzblavQBalxhuMnoH78XhXT213oB2B/qPRlOn7ZgV0LSiYT5VTgM5bz3k32Qj8Ws4q3Eq0sXlQWAT9CKzfGsSlqwvyJz8XKoN74cKlHm27sLrbPAY8bjj2IfZax2f3TwmYHT2pzb0euQGN/TXy28tcZJdYJQn8nqvO72AF7xNJ9mL0EX8JuutyadO5YncxC1DffxNaoN6eTdldvmmUq8BHPti7VZijwaeIDPZZin0C6UBXnIc+xBOL5ORqDvbHh+MlofLQ19rasQj8LjURKErHlCkU7vLI1yoHAN5s4P9A7219oOL4zWll9ie0iaao3WemMqyKbzyLTkyQT+HcC2yYfWiK2x+3KG0ee7h1JvtNWPTNcgT0E8jNocI2RNIV+EHa/+0aYj8apboUK5TvQFVOX7/b+JIuL3Z/s73qDacwBbRjZxM666E+y79P1+aX1412AWnJM7IomkTKSptBv7rheI296FVqM7GngX2i42n3AWR7nnov6vviQSpS9B3Gxsyuw66DrY9Zhm2FlZTMxOmG/NldsSNdb9ArMaw5dOOTaV+h9bl02OzXYP+CkXF3ZbAxC7bau+N1G0nw0ymTq43kXoXGnJgaiyZfS5jU06slEF/5+LRNxTxyzPa/lw2v4WeRi8RX6qo7UXbOtjkbD7IuaBV23bpdKkpTT0TuAjW2Bbzna7EHr3ARGo+paLXNw56Y5E3eyo0ZiGZ5wHD8BDRm0qVe7AL/B7qTXgz3KrBEuxy+nTx0+emx/NFwtmpGgH+rT7Csw05INzcnraPTMndh1z88BfwL+z3Dc5RD2Q/Su4uPqsAQ4HjVtmngf8LvIvj+jD9Mm+gHfBz6FujzMrewfiH4H69DYg/gfgEMdbc5BM5VNBZ5CdepBqNo1ubK5ElQ9jt1FuBHmo7r9txOfKe5sCGmwUkR2iIlcd2VDmCvubAjnefT/kohsEHPumiIyy3Huzo7+o9uejuvNFJGhkXMme7yHZlguIltK/VhHiMjzGfctInJSTN8+2RB2N5xX3dYS/W6T4J0NoVmuI7uFma/gzoOyATpTRtkZexCCzfXAxKPYHbs2RvNs1vJXNLVeq1mAqi9Z8hB2L8lmaEi3b4XQP4HqpFlyIu7A8EPp9c+o4grn+xvJExQtRhPX2oh76DuTxnPJN8Pl6EpnFsyngSCPhFxOwofkrIX+YVSHfSXjfmbgZ8Y8Hy1uUMX18H13g+NxnRfngPYSmn7QlXuyEVzm4uNR19w0mY1mtXss5etGmYefQ+F/yUro56N28j2xe8alyWW4ExMNo9f9dDvsuVOWo9U1GuF+7JH82xCfyflxdHEl+qDbLD6ZKj6FmkabNS0K+j3shPuOlxaXkSBdSTX3SaOrZYJadRaiasyv0WDdCWg2XKsPRKVfW9+u41FOw60iTEZ9y12z/D+Bfyfou5YnsZvo+mN2cJuN5pjcCzUF2rKomXiz0v91qBPWZHRhz8XVqBXpZNTalmRB6WV00WgX1NvR58fjmnR9v/tX8fSlB7q6RGR9NFpoAI3lJlmKPhA1qsJMRE2n0b670B9UUlPXWDS5qGmVsxpJtAQ1t8bNgNX6Ua4ERjY2RYPV48bRHxVmnxpZo9C70jZo5NBaqEuDoHeTtyrXmosK2ky09lcai0Gbod/PBPRzXQM1k/ZU+p1beQ+Po4E6tkW2OEajuWviPqMudB3G95pD0dpYNhnuByzuEil6bEEgkIxOCCIJBPoQhD7QcZQ1iMTG+vTq/cPQZ5m3Ud1xDmo6fDm30WXPCDSDxAb06ujV54OlqFFiHvqcUMrPoRVCPwa4EfVdSaN0Z5WhqN39co+2u6IVM/ZAHzCHWtq+gVpt7kVXSW2xr1GmoKV0XFYrE9Uf32zUGvZ3NItDo9erMga1CB2M+uiMwm4Z6amMYx5qcn4Cteb8MtLuPOCoFMZXyxC01kBTOeitOHwb0tg2EpE3E/pH+HK2o+/dRSugNMNU8S8G/asm+4pjpoicIyLDPMdQuw0RrdKyMIVxPC/1PkNXpXDdOG6R5O/Ve2uFTp+leci24HIeGnDSbKnIfdBFKp+8MVm8141R/5gHMSeUimND1Lv0q6TjOv0c9akRs/puMzUplvVB9kfAl0kvRK0/6pc/JaXrNcIE1MXbJyf7SDQrQJrBMa7YhcJQRqE/mXrHsrQ4C00YmhcbAhd4tLuQ9APdn0r5erlRNqHfGL2dZ8nXUctPXnwQe+KoHUmY0NQTHzeGQlB0k2U0Yup4/ErUr0DTP89GLQ9DURPeONyfyRhUqPJSdfqhVhhTfMIx+E1mK1ET7RuoGjgQtZxUsy/UfrYraK3bc6ZpT9pB6OcCH0d9OZKmnIjOPu/3OO9aVGDjHMImouFxhzmucQiNCf15qF4ejScVNARvI9QEuJfjOtEglFpc54KaeS9GH06r5sZuVPCHoeVPR6Pq1HjUxNmIzf58tOiyLX42Sn/Sj6fuQzsI/VLUJu5MvOlgM9zJlL6HBpSbeAzNYvZT1NXWxAR0kSupU9cM3O62P0XLk9ryMpqivTZEfzg2LiY+yHxpZVtEgwHXMTxJ69yLvWkHnd5V2tGXMdhrxc7Df3b+NvYsxGvgLg0fh++dzBUCZ0oANRINFDexFHsS1LRpy+J77SD0aWFbZQVNFuXr/vw8bhNdklt2Ul7AHqa4GvE/IFeB6OdpPEagNJRJ6F2zSlJf7zSX1pNSzdtpo5EFHFcccUdQJqF30Za3WgNZjbXVxa3bMlijHR5khTb9cHIkq8+j1T/8CWiaFV9VcDVUtct09bcdhH4gGg6XxGTZH7Wzz89qUDkzgNZlAc6SL5IsezToQ/yJGYzlv7SD0I9BU9Ul5aPANSmPpV3YFHv+yBX418UtGmm6n8dSZJ2+iCqR7xfqStbaSIaEQIV2mOk7ie3RVHTRWVxQc+M44AjcRdl8sigEDAShby1n4ZeJzYWpnm3AgyKrN53KfODWvAeRIZnLZJFn+iJYL7LgB6Rb1SNLXkLVOV+r3DBaEIzeDkK/EnVwSvJgujrltV7YuJ7sU2unyVdwl0lqOe0g9LOBd6GpAX3ppnmvzCLRg87wNg/RgCftIPSQvPJcJwn8ArQqYZJUJCaKaOZNnXYR+lbo52l/4Y2M+X50Jbk2We6BaFJWEyPQAO80hD7tOr+FpF2EPg1czlQ+YYS1rOk43siP6BJUL6/lWOAqx3lT0GRLroAM15iSfgalpEwmS1vQB/SmuvZhK9RZqpn+4oibZK7G7U4xGPVJccUMLMX+4x9H+lkSCkeZhH4Wdh/4YWjMpg/fobd2bhyvka5p7XTcwR3bAd90tJmP3We+P/ClBONqlla7MntRJvXmBTQ6yhY0fThaye8CVEeuCm43qldPRldMt3f0NZ10g5fno7l67sQ+EZ2MZi27yXB8DuqiMMlyjSPQoO9L0JjdJejzyQDUFDwCVYPGoPG249EQxCNJ7vOzHzp5uCK6ahmIBvxntgBXJqEHTbhqE3rQ8jA30pug9G30ixmNW32o4qpt1Qh3o3ci10x8MZr+w7RAdRd2oQfYu7KtQF26u1BZGEz8j64H/REkFfqPVrak3EqGQl8m9QbgSvyr8w1Dddwt0VR5vgL/FJpGJAvOwe1mPZb4mrhVrsW/DOgANMh9OBroYZKHfqi7c6sIuSwT8DrZ1qwVVP/OMn72s7hjWQ8DPmM49iT2H0WjbJHBNXOhbEIPcAPpeDLGcSJwe0bXrjIdv2ijKWglwDjOQZNKpcmWKV8vN8oo9KAPqseiVTXSYD76AOhbtrFZLkWfT2wMx54f5wg0aVRajE/xWrnSCqFvpk5tM/wCTdP3Mxp3TluEpv2eSP2iUhxp1UUFOBV34endgIsMx5YARwMfQVWeZhmLPgfVkpX8FD6X5VuoiW0w9XbbAaiZLSsd+QU0Pd/XgYNQE9o70exkQ+n74VZLzsxB66LeBfyBBJWo0VI5w4n3DRqMutr6Mgf4NGqmXGZo0x81K45Fa8fGcV1lew+a+HWnyjkjqHdL6EH9oBajaxGz0PWDGWg932juoIfQPJdp+kJ1o2blzOjEOrLdwNqoiXJLNO32bNQ2PK+yld2hbV30/W+M5gBdiWYlrmYxXkjGSVTz5P8BRvHOlTKdRNMAAAAASUVORK5CYII=";

const STORAGE_KEY = "reclamacoes:registo";
const STORAGE_OPTIONS_KEY = "reclamacoes:opcoes";
const STORAGE_AUDITS_KEY = "reclamacoes:auditorias";
const STORAGE_SANCOES_KEY = "reclamacoes:sancoes";
const STORAGE_TRIAGEM_KEY = "reclamacoes:triagem-aprendizagem";
const STORAGE_INSCRITOS_KEY = "reclamacoes:inscritos";
const STORAGE_TURMAS_KEY = "reclamacoes:turmas-alunos";
const STORAGE_EPOCA_ANT_KEY = "reclamacoes:epoca-anterior";
const STORAGE_DESISTENCIAS_KEY = "reclamacoes:desistencias";
const STORAGE_EXPERIENCIAS_KEY = "reclamacoes:experiencias";
const STORAGE_DESVINC_KEY = "reclamacoes:desvinculacoes";
const STORAGE_ESPACOS_KEY = "reclamacoes:espacos";
const STORAGE_EVENTOS_KEY = "reclamacoes:eventos";
const STORAGE_SATISFACAO_KEY = "reclamacoes:satisfacao";

// ---------- Date / business-day helpers (PT holidays) ----------
function easterSunday(year) {
  // Anonymous Gregorian algorithm
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function ptHolidays(year) {
  const easter = easterSunday(year);
  const goodFriday = addDays(easter, -2);
  const corpusChristi = addDays(easter, 60);
  const fixed = [
    [0, 1], [3, 25], [4, 1], [5, 10], [7, 15],
    [11, 1], [11, 8], [11, 25],
  ].map(([m, d]) => new Date(year, m, d));
  return [...fixed, goodFriday, corpusChristi].map((d) => d.toDateString());
}

function isBusinessDay(date) {
  const day = date.getDay();
  if (day === 0 || day === 6) return false;
  const holidays = ptHolidays(date.getFullYear());
  return !holidays.includes(date.toDateString());
}

function addBusinessDays(startDate, n) {
  let d = new Date(startDate);
  let remaining = n;
  while (remaining > 0) {
    d = addDays(d, 1);
    if (isBusinessDay(d)) remaining -= 1;
  }
  return d;
}

function fmt(date) {
  return new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

// Época desportiva: começa em julho. Uma data de 2026-03 pertence a 2025/26.
function epocaDe(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return "";
  const ano = d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1;
  return `${ano}/${String(ano + 1).slice(2)}`;
}

// Lista de épocas para escolher: a atual e as anteriores, mais a seguinte.
function epocasDisponiveis(extra) {
  const hoje = new Date();
  const anoBase = hoje.getMonth() >= 6 ? hoje.getFullYear() : hoje.getFullYear() - 1;
  const lista = [];
  for (let a = anoBase + 1; a >= anoBase - 8; a--) lista.push(`${a}/${String(a + 1).slice(2)}`);
  (extra || []).forEach((e) => {
    if (e && !lista.includes(e)) lista.push(e);
  });
  return lista.sort().reverse();
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function deriveStatus(item) {
  if (item.status === "concluido") return "concluido";
  const today = startOfDay(new Date());
  const deadline = startOfDay(new Date(item.deadline));
  if (today > deadline) return "atrasado";
  return item.status === "em_andamento" ? "em_andamento" : "por_pegar";
}

const STATUS_META = {
  por_pegar: { label: "Por iniciar", color: COLORS.warn, bg: COLORS.warnBg },
  em_andamento: { label: "Em andamento", color: COLORS.progress, bg: COLORS.progressBg },
  atrasado: { label: "Atrasado", color: COLORS.danger, bg: COLORS.dangerBg },
  concluido: { label: "Concluído", color: COLORS.ok, bg: COLORS.okBg },
};

const SEVERITY_META = {
  baixa: { label: "Baixa", color: COLORS.ok, bg: COLORS.okBg },
  media: { label: "Média", color: COLORS.warn, bg: COLORS.warnBg },
  alta: { label: "Alta", color: COLORS.danger, bg: COLORS.dangerBg },
};

const CLASSIFICATION_META = {
  NCM: { label: "Não conformidade maior", color: COLORS.danger, bg: COLORS.dangerBg },
  NC: { label: "Não conformidade", color: COLORS.warn, bg: COLORS.warnBg },
  OM: { label: "Oportunidade de Melhoria", color: COLORS.progress, bg: COLORS.progressBg },
  AS: { label: "Área Sensível", color: COLORS.purple, bg: COLORS.purpleBg },
};

// Prazo legal: sempre 10 dias úteis a contar da data de receção.
const BUSINESS_DAYS_DEADLINE = 10;

const CANAL_META = {
  email: { label: "E-mail", color: COLORS.progress, bg: COLORS.progressBg },
  presencial: { label: "Pessoal", color: COLORS.ok, bg: COLORS.okBg },
  livro: { label: "Livro de Reclamações", color: COLORS.navy, bg: COLORS.rule },
  redes: { label: "Redes Sociais", color: COLORS.purple, bg: COLORS.purpleBg },
};

// Categoria da reclamação passa a ser uma lista editável (options.complaintCategories),
// com estas como sugestão inicial — deixou de ser um enum fixo.
const DEFAULT_CATEGORIAS = ["Disciplinar", "Técnico", "Infraestrutura e Equipamentos"];

// Tipos de sanção aplicáveis a pais/EE — lista editável (options.sanctionTypes).
const DEFAULT_MOTIVOS_DESISTENCIA = [
  "Mudança de residência",
  "Motivos financeiros",
  "Desmotivação / falta de interesse",
  "Lesão ou problema de saúde",
  "Incompatibilidade de horários",
  "Mudança para outro clube",
  "Insatisfação com a experiência",
  "Fim de ciclo / idade",
  "Não especificado",
  "Outro",
];

const DEFAULT_CATEGORIAS_SATISFACAO = [
  "Treinador / equipa técnica",
  "Comunicação com os encarregados",
  "Instalações",
  "Equipamento e material",
  "Horários e organização",
  "Secretaria / atendimento",
];

const DEFAULT_ESPACOS = ["Campo 1", "Campo 2", "Meio-campo A", "Meio-campo B", "Pavilhão"];
const DIAS_SEMANA = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

const QUEM_PEDIU = ["Encarregado de educação", "Outro clube", "Iniciativa da escola"];

const XP_RESULTADO_META = {
  pendente: { label: "Por avaliar", color: COLORS.warn, bg: COLORS.warnBg },
  sucesso: { label: "Converteu", color: COLORS.ok, bg: COLORS.okBg },
  insucesso: { label: "Não converteu", color: COLORS.danger, bg: COLORS.dangerBg },
};

// Capacidade sugerida por turma, ajustável no registo.
function capacidadeSugerida(turma, niveis) {
  const mapa = { "Raíz": 12, "Iniciação": 14, "Básico": 16, "Intermédio": 16, "Avançado": 18, "Expert": 18 };
  if (mapa[turma]) return mapa[turma];
  return ehEscolinha(turma, niveis) ? 16 : 20;
}

// Mês (aaaa-mm) a partir de uma data ISO, para filtros e agregações.
function mesDeData(d) {
  return d ? String(d).slice(0, 7) : "";
}

// Cor da barra de lotação consoante a ocupação.
function corLotacao(pct) {
  if (pct >= 95) return COLORS.danger;
  if (pct >= 80) return COLORS.ok;
  if (pct >= 50) return COLORS.warn;
  return COLORS.slate;
}

const DEFAULT_AREAS_AUDITORIA = ["Técnica", "Médica", "Instalações e Equipamentos", "Administrativa", "Escolar e Social"];

const DEFAULT_NIVEIS = ["Raíz", "Iniciação", "Básico", "Intermédio", "Avançado", "Expert"];
const DEFAULT_TURMAS = [
  ...DEFAULT_NIVEIS,
  "Sub-6", "Sub-7", "Sub-8", "Sub-9", "Sub-9B", "Sub-9 B - GR", "Sub-10", "Sub-11", "Sub-11A",
  "Sub-11 - GR", "Sub-12", "Sub-13", "Sub-14", "Sub-15", "Sub-15B", "Sub-16", "Sub-17", "Sub-19",
  "Equipa Competição",
];

const EFICACIA_ACAO_META = {
  eficaz: { label: "Eficaz", color: COLORS.ok, bg: COLORS.okBg },
  parcial: { label: "Parcialmente eficaz", color: COLORS.warn, bg: COLORS.warnBg },
  ineficaz: { label: "Ineficaz", color: COLORS.danger, bg: COLORS.dangerBg },
};

// Classificação do crescimento de inscritos. Os limites são configuráveis na app.
const LIMITES_CRESC_PADRAO = { critico: -10, declinio: -2, estavel: 2 };
const CLASSES_CRESC = [
  { key: "critico", label: "Crítico", color: COLORS.danger, bg: COLORS.dangerBg },
  { key: "declinio", label: "Declínio moderado", color: COLORS.warn, bg: COLORS.warnBg },
  { key: "estavel", label: "Estável", color: COLORS.slate, bg: COLORS.doneBg },
  { key: "positiva", label: "Evolução positiva", color: COLORS.ok, bg: COLORS.okBg },
];
function classificarCrescimento(pct, limites) {
  const L = limites || LIMITES_CRESC_PADRAO;
  if (pct < L.critico) return CLASSES_CRESC[0];
  if (pct < L.declinio) return CLASSES_CRESC[1];
  if (pct <= L.estavel) return CLASSES_CRESC[2];
  return CLASSES_CRESC[3];
}

// Escalão a partir do nome da turma: "Sub-11A" -> "Sub-11"; níveis mantêm o nome.
function escalaoDaTurma(t, niveis) {
  if (!t) return "—";
  const m = String(t).match(/^sub[\s-]*(\d+)/i);
  if (m) return "Sub-" + m[1];
  const n = (niveis || DEFAULT_NIVEIS).find((x) => String(t).toLowerCase().startsWith(x.toLowerCase()));
  return n || "Competição (outras)";
}
function ehEscolinha(t, niveis) {
  return (niveis || DEFAULT_NIVEIS).includes(escalaoDaTurma(t, niveis));
}

// Semana ISO no formato aaaa-Wnn, e etiqueta legível.
function semanaLabel(key) {
  if (!key) return "";
  const [ano, sem] = String(key).split("-W");
  return `S${sem}/${String(ano).slice(2)}`;
}
function mesDaSemana(key) {
  const [ano, sem] = String(key).split("-W");
  const d = new Date(Date.UTC(+ano, 0, 4));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + (+sem - 1) * 7);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

const DEFAULT_TIPOS_SANCAO = [
  "Suspensão da pessoa",
  "Treinos à porta fechada",
  "Expulsão",
  "Advertência escrita",
];

// Paleta usada para colorir categorias e temas de forma consistente, já que
// deixaram de ter uma cor fixa por serem listas geríveis pelo utilizador.
const TAG_PALETTE = [
  { color: COLORS.danger, bg: COLORS.dangerBg },
  { color: COLORS.progress, bg: COLORS.progressBg },
  { color: COLORS.warn, bg: COLORS.warnBg },
  { color: COLORS.purple, bg: COLORS.purpleBg },
  { color: COLORS.ok, bg: COLORS.okBg },
  { color: COLORS.navySoft, bg: COLORS.rule },
];
function colorForLabel(label) {
  if (!label) return { color: COLORS.slate, bg: COLORS.doneBg };
  let hash = 0;
  for (let i = 0; i < label.length; i++) hash = (hash * 31 + label.charCodeAt(i)) >>> 0;
  return TAG_PALETTE[hash % TAG_PALETTE.length];
}

const EFICACIA_META = {
  eficaz: { label: "Eficaz", color: COLORS.ok, bg: COLORS.okBg },
  parcial: { label: "Parcialmente eficaz", color: COLORS.warn, bg: COLORS.warnBg },
  ineficaz: { label: "Ineficaz", color: COLORS.danger, bg: COLORS.dangerBg },
};

// ---------- Sanções / ocorrências disciplinares ----------
const MOTIVO_META = {
  ma_conduta: { label: "Má conduta", color: COLORS.warn, bg: COLORS.warnBg },
  ameacas: { label: "Ameaças", color: COLORS.danger, bg: COLORS.dangerBg },
  insultos: { label: "Insultos", color: COLORS.danger, bg: COLORS.dangerBg },
  agressao: { label: "Agressão", color: COLORS.danger, bg: COLORS.dangerBg },
  outro: { label: "Outro", color: COLORS.slate, bg: COLORS.doneBg },
};

const PERSON_TYPE_META = {
  familia: { label: "Pai / Encarregado de Educação" },
  elemento_df: { label: "Elemento Dragon Force" },
};

const DF_STAGE_META = {
  ocorrencia: { label: "Ocorrência registada", color: COLORS.slate, bg: COLORS.doneBg },
  inquerito: { label: "Inquérito disciplinar aberto", color: COLORS.warn, bg: COLORS.warnBg },
  proposta: { label: "Sanção proposta (para decisão)", color: COLORS.progress, bg: COLORS.progressBg },
  decisao_suspensao: { label: "Decisão: Suspensão", color: COLORS.danger, bg: COLORS.dangerBg },
  decisao_expulsao: { label: "Decisão: Expulsão do projeto", color: COLORS.danger, bg: COLORS.dangerBg },
  decisao_arquivado: { label: "Decisão: Arquivado / sem sanção", color: COLORS.ok, bg: COLORS.okBg },
};

// ---------- Stamp badge (signature element) ----------
function Stamp({ statusKey, onClick }) {
  const meta = STATUS_META[statusKey];
  return (
    <span
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 10px",
        borderRadius: 3,
        border: `1.5px solid ${meta.color}`,
        color: meta.color,
        background: meta.bg,
        fontVariantNumeric: "tabular-nums",
        fontSize: 11,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        fontWeight: 600,
        whiteSpace: "nowrap",
        cursor: onClick ? "pointer" : "default",
      }}
    >
      {statusKey === "por_pegar" && <Inbox size={12} />}
      {statusKey === "em_andamento" && <Clock size={12} />}
      {statusKey === "atrasado" && <AlertTriangle size={12} />}
      {statusKey === "concluido" && <Check size={12} />}
      {meta.label}
    </span>
  );
}

// ---------- Generic small tag (severity / classification) ----------
function Tag({ label, color, bg, title }) {
  return (
    <span
      title={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        borderRadius: 3,
        border: `1px solid ${color}`,
        color,
        background: bg,
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: "0.03em",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

// ---------- Entry form ----------
// ---------- Triagem automática: classificador por palavras-chave que aprende ----------
// Não usa nenhuma API paga. Aprende sozinho: sempre que uma reclamação é
// guardada, as palavras da descrição/contexto ficam associadas ao tema,
// categoria, gravidade e canal escolhidos. Ao colar um novo e-mail, soma as
// associações aprendidas (mais umas pistas iniciais) e sugere o valor mais
// provável para cada campo — o utilizador confirma ou corrige sempre.

const STOPWORDS = new Set([
  "de", "da", "do", "das", "dos", "que", "para", "com", "uma", "um", "uns", "umas", "este", "esta", "estes",
  "estas", "isso", "isto", "aquilo", "nao", "sim", "foi", "ser", "sido", "tem", "tinha", "teve", "muito",
  "pouco", "mais", "menos", "como", "quando", "onde", "porque", "pois", "mas", "ainda", "sobre", "entre",
  "pela", "pelo", "pelas", "pelos", "esse", "essa", "esses", "essas", "seu", "sua", "seus", "suas", "meu",
  "minha", "meus", "minhas", "nos", "nossa", "nosso", "nossas", "nossos", "eles", "elas", "ele", "ela",
  "isto", "aqui", "ali", "la", "ja", "so", "todo", "toda", "todos", "todas", "outro", "outra", "outros",
  "outras", "mesmo", "mesma", "cada", "qualquer", "algum", "alguma", "alguns", "algumas", "tambem", "depois",
  "antes", "hoje", "ontem", "amanha", "caro", "cara", "prezado", "prezada", "obrigado", "obrigada", "atenciosamente",
  "cumprimentos", "venho", "gostaria", "gostariamos", "informar", "solicitar", "pedir", "the", "and", "for",
]);

function normalizeText(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ");
}

function tokenize(text) {
  return normalizeText(text)
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
}

// Pistas iniciais (funcionam desde o primeiro dia, antes de haver dados aprendidos).
const SEED_HINTS = {
  gravidade: {
    alta: ["agressao", "agrediu", "ameaca", "ameacou", "insulto", "insultou", "violencia", "bateu", "socou", "empurrou", "humilhou", "grave", "perigo", "seguranca", "racista", "discriminacao"],
    media: ["preocupado", "preocupada", "insatisfeito", "insatisfeita", "injusto", "injusta", "desrespeito", "queixa"],
    baixa: ["duvida", "sugestao", "horario", "pequena", "informacao", "esclarecimento", "questao"],
  },
  categoria: {
    "Disciplinar": ["comportamento", "insulto", "agressao", "indisciplina", "respeito", "gritou", "humilhou", "bullying", "conduta", "atitude"],
    "Técnico": ["convocado", "convocatoria", "minutos", "jogo", "treino", "avaliacao", "tecnico", "titular", "suplente", "posicao", "equipa"],
    "Infraestrutura e Equipamentos": ["balneario", "equipamento", "transporte", "pagamento", "mensalidade", "material", "instalacoes", "campo", "autocarro"],
  },
  canal: {
    presencial: ["presencialmente", "pessoalmente", "balcao", "secretaria", "atendimento", "deslocar", "deslocei"],
    livro: ["livro"],
    redes: ["facebook", "instagram", "publicacao", "comentario", "rede", "social", "twitter", "tiktok"],
  },
};

function scoreFromLearned(words, learnedField) {
  const scores = {};
  if (!learnedField) return scores;
  words.forEach((w) => {
    const assoc = learnedField[w];
    if (!assoc) return;
    Object.entries(assoc).forEach(([val, count]) => {
      scores[val] = (scores[val] || 0) + count;
    });
  });
  return scores;
}

function bestFromScores(scores, minScore = 1) {
  const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0 || entries[0][1] < minScore) return null;
  return entries[0][0];
}

function classifyEnum(words, learnedField, seedField) {
  const scores = scoreFromLearned(words, learnedField);
  if (seedField) {
    Object.entries(seedField).forEach(([val, keywords]) => {
      const hits = keywords.filter((kw) => words.includes(kw)).length;
      if (hits > 0) scores[val] = (scores[val] || 0) + hits * 2;
    });
  }
  return bestFromScores(scores);
}

// Compara pela raiz da palavra, para "tecnica"/"tecnico" contarem como "Técnico".
// Exige raiz longa e comprimentos próximos, para evitar falsos positivos como
// "equipa" (da equipa de futebol) colar com "equipamentos".
function stemMatch(a, b) {
  if (a === b) return true;
  const min = Math.min(a.length, b.length);
  if (min < 6) return false;
  if (Math.abs(a.length - b.length) > 3) return false;
  const root = min - 2;
  return a.slice(0, root) === b.slice(0, root);
}

function classifyFromList(words, learnedField, list, seedField) {
  const scores = scoreFromLearned(words, learnedField);
  Object.keys(scores).forEach((val) => {
    if (!list.includes(val)) delete scores[val];
  });
  list.forEach((label) => {
    const labelWords = tokenize(label);
    const hits = labelWords.filter((lw) => words.some((w) => stemMatch(w, lw))).length;
    if (hits > 0) scores[label] = (scores[label] || 0) + hits * 2;
  });
  // Pistas semânticas: reconhecem a categoria pelo assunto ("gritou", "insulto"
  // → Disciplinar) mesmo quando o nome da categoria não aparece no texto.
  if (seedField) {
    Object.entries(seedField).forEach(([label, keywords]) => {
      if (!list.includes(label)) return;
      const hits = keywords.filter((kw) => words.includes(kw)).length;
      if (hits > 0) scores[label] = (scores[label] || 0) + hits;
    });
  }
  return bestFromScores(scores);
}

// Aplica-se ao colar um e-mail: devolve a sugestão de classificação.
// Extrai a data mencionada no texto (dd/mm/aaaa, dd-mm-aaaa, "12 de março").
const MESES_PT = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
function extractDate(rawText) {
  const numeric = rawText.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/);
  if (numeric) {
    const [, d, m, yRaw] = numeric;
    const y = yRaw.length === 2 ? `20${yRaw}` : yRaw;
    const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (!isNaN(new Date(iso + "T00:00:00").getTime())) return iso;
  }
  const norm = normalizeText(rawText);
  const textual = norm.match(/\b(\d{1,2})\s+de\s+([a-z]+)(?:\s+de\s+(\d{4}))?/);
  if (textual) {
    const idx = MESES_PT.indexOf(textual[2]);
    if (idx >= 0) {
      const y = textual[3] || String(new Date().getFullYear());
      return `${y}-${String(idx + 1).padStart(2, "0")}-${String(textual[1]).padStart(2, "0")}`;
    }
  }
  return null;
}

// Tenta encontrar o nome de quem reclama a partir da assinatura ou de fórmulas
// comuns em português ("Chamo-me X", "O meu nome é X", "Atenciosamente, X").
function extractComplainantName(rawText) {
  const patterns = [
    /(?:chamo-me|o meu nome (?:é|e)|sou (?:a|o))\s+([A-ZÁÀÂÃÉÊÍÓÔÕÚÇ][\wÀ-ÿ]+(?:\s+[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ][\wÀ-ÿ]+){0,3})/,
    /(?:atenciosamente|cumprimentos|com os melhores cumprimentos|obrigado|obrigada)[,\s]*\n+\s*([A-ZÁÀÂÃÉÊÍÓÔÕÚÇ][\wÀ-ÿ]+(?:\s+[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ][\wÀ-ÿ]+){1,3})/i,
  ];
  for (const re of patterns) {
    const m = rawText.match(re);
    if (m && m[1]) return m[1].trim();
  }
  return "";
}

function extractEmailLink(rawText) {
  const url = rawText.match(/https?:\/\/[^\s<>"')]+/);
  return url ? url[0] : "";
}

// Escolhe a escola mencionada no texto. Primeiro tenta o nome completo; se não
// encontrar, aceita correspondência pelas palavras distintivas do nome (ex:
// "Gondomar" basta para reconhecer "Dragon Force Gondomar"), ignorando termos
// genéricos que aparecem em quase todas as escolas.
const SCHOOL_GENERIC_WORDS = new Set(["dragon", "force", "escola", "academia", "centro", "clube", "futebol", "df"]);
function matchSchool(rawText, schools) {
  const norm = normalizeText(rawText);
  const textWords = new Set(tokenize(rawText));

  let best = "";
  let bestLen = 0;
  (schools || []).forEach((s) => {
    const ns = normalizeText(s).trim();
    if (ns && norm.includes(ns) && ns.length > bestLen) {
      best = s;
      bestLen = ns.length;
    }
  });
  if (best) return best;

  let bestScore = 0;
  (schools || []).forEach((s) => {
    const distinctive = tokenize(s).filter((w) => !SCHOOL_GENERIC_WORDS.has(w));
    if (distinctive.length === 0) return;
    const hits = distinctive.filter((w) => textWords.has(w)).length;
    if (hits > bestScore) {
      bestScore = hits;
      best = s;
    }
  });
  return bestScore > 0 ? best : "";
}

function classifyText(rawText, learned, temas, categorias, schools) {
  const words = tokenize(rawText);
  const canal = classifyEnum(words, learned.canal, SEED_HINTS.canal) || "email";
  const gravidade = classifyEnum(words, learned.gravidade, SEED_HINTS.gravidade) || "media";
  const categoria = classifyFromList(words, learned.categoria, categorias, SEED_HINTS.categoria) || "";
  const tema = classifyFromList(words, learned.tema, temas) || "";

  // Remove a assinatura final antes de dividir em resumo/contexto, para não
  // ficar "Atenciosamente, Maria Silva" no meio do contexto.
  const semAssinatura = rawText.replace(
    /\n\s*(atenciosamente|cumprimentos|com os melhores cumprimentos|melhores cumprimentos|obrigado|obrigada|abra[çc]o)[,.\s]*[\s\S]*$/i,
    ""
  );

  // Remove a saudação inicial ("Boa tarde,", "Exmos. Senhores,") do resumo.
  const semSaudacao = semAssinatura.replace(
    /^\s*(bom dia|boa tarde|boa noite|ol[áa]|exmos?\.?\s+senhores?|exmo\.?\s+senhor|caros?|prezados?)[,.\s]*/i,
    ""
  );

  // Divide o texto: as primeiras frases viram resumo, o resto vai para contexto.
  const trimmed = semSaudacao.trim().replace(/[ \t]+/g, " ");
  const sentences = trimmed.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
  let resumo = "";
  let i = 0;
  while (i < sentences.length && resumo.length < 200) {
    resumo += (resumo ? " " : "") + sentences[i].trim();
    i++;
  }
  const contexto = sentences.slice(i).join(" ").trim();

  return {
    canal,
    gravidade,
    categoria,
    tema,
    resumo,
    contexto,
    school: matchSchool(rawText, schools),
    complainant: extractComplainantName(rawText),
    emailLink: extractEmailLink(rawText),
    receivedDate: extractDate(rawText),
    _hadAnyMatch: words.length > 0,
  };
}

// Chamado sempre que uma reclamação é guardada — reforça as associações
// entre as palavras do texto e a classificação escolhida (final, já corrigida
// pelo utilizador se necessário). É assim que a triagem "aprende" ao longo do tempo.
function learnFromEntry(learned, entry) {
  const text = `${entry.description || ""} ${entry.context || ""}`;
  const words = tokenize(text);
  if (words.length === 0) return learned;
  const next = {
    canal: { ...(learned.canal || {}) },
    categoria: { ...(learned.categoria || {}) },
    tema: { ...(learned.tema || {}) },
    gravidade: { ...(learned.gravidade || {}) },
  };
  const bump = (field, value) => {
    if (!value) return;
    words.forEach((w) => {
      next[field][w] = { ...(next[field][w] || {}) };
      next[field][w][value] = (next[field][w][value] || 0) + 1;
    });
  };
  bump("canal", entry.canal);
  bump("categoria", entry.categoria);
  bump("tema", entry.tema);
  bump("gravidade", entry.severity);
  return next;
}


function TriageBox({ onApply, temas, categorias, learned, schools }) {
  const [emailText, setEmailText] = useState("");
  const [triageError, setTriageError] = useState(null);
  const [open, setOpen] = useState(false);

  const runTriage = () => {
    const text = emailText.trim();
    if (!text) return;
    setTriageError(null);
    const result = classifyText(text, learned || {}, temas, categorias, schools);
    if (!result._hadAnyMatch) {
      setTriageError("Texto demasiado curto para reconhecer padrões. Preenche os campos manualmente.");
      return;
    }
    onApply(result);
  };

  return (
    <div style={{ marginBottom: 18, border: `1.5px dashed ${COLORS.navySoft}`, borderRadius: 5, padding: "12px 14px", background: "#F4F7FA" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "transparent",
          border: "none",
          padding: 0,
          cursor: "pointer",
          fontSize: 13,
          fontWeight: 700,
          color: COLORS.navySoft,
        }}
      >
        <Sparkles size={15} />
        Triagem automática (colar texto do e-mail)
      </button>
      {open && (
        <div style={{ marginTop: 10 }}>
          <textarea
            rows={6}
            placeholder="Cola aqui o corpo do e-mail recebido..."
            value={emailText}
            onChange={(e) => setEmailText(e.target.value)}
            style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit", marginBottom: 8 }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              onClick={runTriage}
              disabled={!emailText.trim()}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                borderRadius: 4,
                border: "none",
                background: COLORS.navySoft,
                color: COLORS.onAccent,
                fontSize: 12.5,
                fontWeight: 600,
                cursor: !emailText.trim() ? "default" : "pointer",
                opacity: !emailText.trim() ? 0.6 : 1,
              }}
            >
              <Sparkles size={14} />
              Sugerir classificação
            </button>
            <div style={{ fontSize: 11, color: COLORS.slate }}>
              Preenche data, nome, escola, canal, categoria, tema, gravidade, resumo e contexto. Confirma ou corrige sempre.
            </div>
          </div>
          {triageError && <div style={{ color: COLORS.danger, fontSize: 12, marginTop: 8 }}>{triageError}</div>}
        </div>
      )}
    </div>
  );
}

function EntryForm({ initial, nextNumber, onCancel, onSave, schoolOptions, categoryOptions, categoriaOptions, onGerirLista, learned }) {
  const [form, setForm] = useState(
    initial || {
      receivedDate: new Date().toISOString().slice(0, 10),
      epoca: epocaDe(new Date().toISOString().slice(0, 10)),
      complainant: "",
      school: "",
      tema: "",
      categoria: "",
      canal: "email",
      severity: "media",
      description: "",
      context: "",
      emailLink: "",
    }
  );
  const [suggested, setSuggested] = useState(new Set());

  const preview = useMemo(() => {
    if (!form.receivedDate) return null;
    return addBusinessDays(new Date(form.receivedDate + "T00:00:00"), BUSINESS_DAYS_DEADLINE);
  }, [form.receivedDate]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // A época acompanha a data de receção, a menos que tenha sido escolhida à mão.
  const [epocaManual, setEpocaManual] = useState(false);
  const setReceived = (e) => {
    const v = e.target.value;
    setForm((f) => ({ ...f, receivedDate: v, epoca: epocaManual ? f.epoca : epocaDe(v) }));
  };

  const applyTriage = (data) => {
    const next = { ...form };
    const applied = new Set();
    if (data.tema && categoryOptions.includes(data.tema)) {
      next.tema = data.tema;
      applied.add("tema");
    }
    if (data.categoria && categoriaOptions.includes(data.categoria)) {
      next.categoria = data.categoria;
      applied.add("categoria");
    }
    if (data.gravidade && SEVERITY_META[data.gravidade]) {
      next.severity = data.gravidade;
      applied.add("severity");
    }
    if (data.canal && CANAL_META[data.canal]) {
      next.canal = data.canal;
      applied.add("canal");
    }
    if (data.resumo) {
      next.description = data.resumo;
      applied.add("description");
    }
    if (data.contexto) {
      next.context = data.contexto;
      applied.add("context");
    }
    if (data.school && schoolOptions.includes(data.school)) {
      next.school = data.school;
      applied.add("school");
    }
    if (data.complainant) {
      next.complainant = data.complainant;
      applied.add("complainant");
    }
    if (data.emailLink) {
      next.emailLink = data.emailLink;
      applied.add("emailLink");
    }
    if (data.receivedDate) {
      next.receivedDate = data.receivedDate;
      applied.add("receivedDate");
      if (!epocaManual) next.epoca = epocaDe(data.receivedDate);
    }
    setForm(next);
    setSuggested(applied);
  };

  const fieldHint = (key) =>
    suggested.has(key) ? (
      <span style={{ fontSize: 10.5, color: COLORS.navySoft, fontWeight: 700, marginLeft: 6 }}>· sugerido, confirma</span>
    ) : null;

  return (
    <div
      className="veil"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(8,14,24,0.5)",
        display: "flex",
        justifyContent: "flex-end",
        zIndex: 50,
      }}
      onClick={onCancel}
    >
      <div
        className="drawer"
        style={{
          width: "min(470px, 100%)",
          background: COLORS.paperRaised,
          height: "100%",
          padding: "24px 24px 32px",
          overflowY: "auto",
          borderLeft: `1px solid ${COLORS.rule}`,
          boxShadow: "-14px 0 40px -10px rgba(8,14,24,0.3)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <div style={{ fontVariantNumeric: "tabular-nums", fontSize: 12, color: COLORS.slate, letterSpacing: "0.08em" }}>
              ENTRADA Nº {String(initial ? initial.entryNumber : nextNumber).padStart(4, "0")}
            </div>
            <h2 style={{ margin: "4px 0 0", fontSize: 22, color: COLORS.navy }}>
              {initial ? "Editar reclamação" : "Nova reclamação"}
            </h2>
          </div>
          <button onClick={onCancel} style={iconBtnStyle}>
            <X size={18} />
          </button>
        </div>

        {!initial && <TriageBox onApply={applyTriage} temas={categoryOptions} categorias={categoriaOptions} learned={learned} schools={schoolOptions} />}

        <label style={{ ...labelStyle, marginTop: 0 }}>Canal de contacto{fieldHint("canal")}</label>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
          {Object.entries(CANAL_META).map(([key, meta]) => (
            <button
              key={key}
              type="button"
              onClick={() => setForm((f) => ({ ...f, canal: key }))}
              style={{
                flex: "1 1 45%",
                padding: "9px 8px",
                borderRadius: 4,
                border: `1.5px solid ${form.canal === key ? COLORS.navy : COLORS.rule}`,
                background: form.canal === key ? COLORS.navy : "transparent",
                color: form.canal === key ? COLORS.onAccent : COLORS.ink,
                fontSize: 12.5,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {meta.label}
            </button>
          ))}
        </div>

        <label style={labelStyle}>Data de receção{fieldHint("receivedDate")}</label>
        <input type="date" value={form.receivedDate} onChange={setReceived} style={inputStyle} />

        <label style={labelStyle}>Época</label>
        <select
          value={form.epoca || ""}
          onChange={(e) => {
            setEpocaManual(true);
            setForm((f) => ({ ...f, epoca: e.target.value }));
          }}
          style={inputStyle}
        >
          {epocasDisponiveis([form.epoca]).map((ep) => (
            <option key={ep} value={ep}>
              {ep}
            </option>
          ))}
        </select>
        <div style={{ fontSize: 11, color: COLORS.slate, marginTop: 4 }}>
          Preenchida a partir da data de receção. Muda-a se estiveres a registar uma reclamação de outra época.
        </div>
        {preview && (
          <div style={{ margin: "8px 0 4px", fontSize: 12.5, color: COLORS.slate, fontVariantNumeric: "tabular-nums" }}>
            Prazo (10 dias úteis) → <strong style={{ color: COLORS.navy }}>{fmt(preview)}</strong>
          </div>
        )}

        <label style={labelStyle}>Gravidade{fieldHint("severity")}</label>
        <div style={{ display: "flex", gap: 8 }}>
          {Object.entries(SEVERITY_META).map(([key, meta]) => (
            <button
              key={key}
              type="button"
              onClick={() => setForm((f) => ({ ...f, severity: key }))}
              style={{
                flex: 1,
                padding: "8px 6px",
                borderRadius: 4,
                border: `1.5px solid ${form.severity === key ? meta.color : COLORS.rule}`,
                background: form.severity === key ? meta.bg : "transparent",
                color: form.severity === key ? meta.color : COLORS.ink,
                fontSize: 12.5,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {meta.label}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <label style={{ ...labelStyle }}>Categoria{fieldHint("categoria")}</label>
          <button type="button" onClick={() => onGerirLista("complaintCategories")} style={linkBtnStyle}>
            Gerir lista
          </button>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {categoriaOptions.length === 0 && <div style={{ fontSize: 12, color: COLORS.slate }}>Sem categorias — usa "Gerir lista" para adicionar.</div>}
          {categoriaOptions.map((label) => {
            const meta = colorForLabel(label);
            return (
              <button
                key={label}
                type="button"
                onClick={() => setForm((f) => ({ ...f, categoria: label }))}
                style={{
                  flex: "1 1 30%",
                  padding: "8px 6px",
                  borderRadius: 4,
                  border: `1.5px solid ${form.categoria === label ? meta.color : COLORS.rule}`,
                  background: form.categoria === label ? meta.bg : "transparent",
                  color: form.categoria === label ? meta.color : COLORS.ink,
                  fontSize: 11.5,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        <label style={labelStyle}>Reclamante (nome){fieldHint("complainant")}</label>
        <input type="text" placeholder="Nome de quem faz a reclamação" value={form.complainant} onChange={set("complainant")} style={inputStyle} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <label style={{ ...labelStyle, marginTop: 14 }}>Escola{fieldHint("school")}</label>
          <button type="button" onClick={() => onGerirLista("schools")} style={linkBtnStyle}>
            Gerir lista
          </button>
        </div>
        <select value={form.school} onChange={set("school")} style={inputStyle}>
          <option value="">{schoolOptions.length ? "Selecionar escola..." : "Sem escolas — usa 'Gerir lista'"}</option>
          {schoolOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <label style={{ ...labelStyle, marginTop: 14 }}>Tema (mais específico que a categoria){fieldHint("tema")}</label>
          <button type="button" onClick={() => onGerirLista("categories")} style={linkBtnStyle}>
            Gerir lista
          </button>
        </div>
        <select value={form.tema} onChange={set("tema")} style={inputStyle}>
          <option value="">{categoryOptions.length ? "Selecionar tema..." : "Sem temas — usa 'Gerir lista'"}</option>
          {categoryOptions.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <label style={labelStyle}>Hiperligação ao e-mail recebido{fieldHint("emailLink")}</label>
        <input
          type="url"
          placeholder="https://mail.google.com/... ou link do Outlook"
          value={form.emailLink}
          onChange={set("emailLink")}
          style={inputStyle}
        />

        <label style={labelStyle}>Descrição (resumo do e-mail){fieldHint("description")}</label>
        <textarea
          rows={4}
          placeholder="Resumo objetivo da reclamação..."
          value={form.description}
          onChange={set("description")}
          style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
        />

        <label style={labelStyle}>Contexto adicional{fieldHint("context")}</label>
        <textarea
          rows={4}
          placeholder="Corpo de texto com mais contexto, histórico, ou detalhes que não cabem no resumo..."
          value={form.context}
          onChange={set("context")}
          style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
        />

        <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
          <button onClick={onCancel} style={secondaryBtnStyle}>
            Cancelar
          </button>
          <button
            onClick={() => {
              if (!form.complainant.trim()) return;
              const deadline = addBusinessDays(new Date(form.receivedDate + "T00:00:00"), BUSINESS_DAYS_DEADLINE);
              onSave({
                ...form,
                deadline: deadline.toISOString(),
                entryNumber: initial ? initial.entryNumber : nextNumber,
                id: initial ? initial.id : `c_${Date.now()}`,
                status: initial ? initial.status : "por_pegar",
              });
            }}
            style={primaryBtnStyle}
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}


// ---------- Estilos partilhados ----------
// São objetos vazios preenchidos por aplicarTema(), para que a troca de tema
// atualize todos os componentes sem ter de passar cores por props.
// Declarados com let porque aplicarTema() os substitui por objetos novos: o
// React congela os objetos de estilo que recebe, por isso não podem ser mutados.
let labelStyle = {};
let inputStyle = {};
let primaryBtnStyle = {};
let secondaryBtnStyle = {};
let iconBtnStyle = {};
let linkBtnStyle = {};
let panelStyle = {};
let panelTitle = {};

function aplicarTema(tema) {
  Object.assign(COLORS, tema === "dark" ? TEMA_ESCURO : TEMA_CLARO);

  labelStyle = {
    display: "block",
    fontSize: 11.5,
    fontWeight: 600,
    color: COLORS.ink2,
    letterSpacing: 0,
    textTransform: "none",
    marginBottom: 5,
    marginTop: 14,
  };

  inputStyle = {
    width: "100%",
    padding: "8px 11px",
    border: `1px solid ${COLORS.rule}`,
    borderRadius: 8,
    fontSize: 13.5,
    color: COLORS.ink,
    background: COLORS.paperRaised,
    boxSizing: "border-box",
    fontFamily: "inherit",
  };

  primaryBtnStyle = {
    flex: 1,
    padding: "9px 14px",
    borderRadius: 8,
    border: "none",
    background: COLORS.navy,
    color: COLORS.onAccent,
    fontWeight: 600,
    fontSize: 13.5,
    cursor: "pointer",
    fontFamily: "inherit",
  };

  secondaryBtnStyle = {
    flex: 1,
    padding: "9px 14px",
    borderRadius: 8,
    border: `1px solid ${COLORS.rule}`,
    background: COLORS.paperRaised,
    color: COLORS.ink,
    fontWeight: 600,
    fontSize: 13.5,
    cursor: "pointer",
    fontFamily: "inherit",
  };

  iconBtnStyle = {
    border: "none",
    background: "transparent",
    color: COLORS.slate,
    cursor: "pointer",
    padding: 4,
    fontFamily: "inherit",
  };

  linkBtnStyle = {
    border: "none",
    background: "transparent",
    color: COLORS.navySoft,
    cursor: "pointer",
    padding: 0,
    fontSize: 12,
    fontWeight: 600,
    textDecoration: "none",
    marginTop: 14,
    fontFamily: "inherit",
  };

  panelStyle = {
    background: COLORS.paperRaised,
    border: `1px solid ${COLORS.rule}`,
    borderRadius: 14,
    padding: "16px 18px",
    boxShadow: COLORS.shadow,
  };

  panelTitle = {
    fontSize: 12.5,
    fontWeight: 600,
    color: COLORS.ink,
    textTransform: "none",
    letterSpacing: "-0.01em",
    marginBottom: 14,
  };
}

aplicarTema("light");

// ---------- Primitivas de interface ----------

// Conta de 0 até ao valor final. Respeita quem desativou animações e trata
// valores com sufixo ("91%", "6,2 d") preservando o formato.
function Contador({ valor, duracao = 700 }) {
  const texto = String(valor ?? "");
  const match = texto.match(/^(-?[\d.,]+)(.*)$/);
  const alvo = match ? parseFloat(match[1].replace(",", ".")) : null;
  const sufixo = match ? match[2] : "";
  const decimais = match && match[1].includes(",") ? (match[1].split(",")[1] || "").length : 0;

  const [mostrado, setMostrado] = useState(alvo === null ? null : 0);

  useEffect(() => {
    if (alvo === null || isNaN(alvo)) return;
    let reduzido = false;
    try {
      reduzido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch (e) {
      // sem matchMedia: segue com animação
    }
    if (reduzido || duracao === 0) {
      setMostrado(alvo);
      return;
    }
    // Alguns ambientes (testes, renderização no servidor) não têm
    // requestAnimationFrame: nesses casos mostra-se o valor final de imediato.
    const raf = typeof window !== "undefined" && window.requestAnimationFrame;
    const cancel = typeof window !== "undefined" && window.cancelAnimationFrame;
    if (!raf) {
      setMostrado(alvo);
      return;
    }
    let handle;
    const agoraFn = () => (typeof performance !== "undefined" && performance.now ? performance.now() : Date.now());
    const inicio = agoraFn();
    const passo = () => {
      const t = Math.min(1, (agoraFn() - inicio) / duracao);
      // Saída suave: rápido no início, assenta no fim.
      const eased = 1 - Math.pow(1 - t, 3);
      setMostrado(alvo * eased);
      if (t < 1) handle = raf(passo);
    };
    handle = raf(passo);
    return () => cancel && cancel(handle);
  }, [alvo, duracao]);

  if (alvo === null || isNaN(alvo)) return <>{texto}</>;
  const fmt = decimais
    ? mostrado.toFixed(decimais).replace(".", ",")
    : Math.round(mostrado).toLocaleString("pt-PT");
  return (
    <>
      {fmt}
      {sufixo}
    </>
  );
}

// Anel de progresso com o traço a desenhar-se à entrada.
function AnelProgresso({ pct, tamanho = 64, espessura = 6, cor, rotulo }) {
  const valor = Math.max(0, Math.min(100, Number(pct) || 0));
  const raio = (tamanho - espessura) / 2;
  const perimetro = 2 * Math.PI * raio;
  const [desenhado, setDesenhado] = useState(0);

  useEffect(() => {
    let reduzido = false;
    try {
      reduzido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch (e) {
      // segue com animação
    }
    if (reduzido) {
      setDesenhado(valor);
      return;
    }
    const raf = typeof window !== "undefined" && window.requestAnimationFrame;
    if (!raf) {
      setDesenhado(valor);
      return;
    }
    const id = raf(() => setDesenhado(valor));
    return () => window.cancelAnimationFrame && window.cancelAnimationFrame(id);
  }, [valor]);

  const corFinal = cor || COLORS.navy;
  return (
    <div style={{ position: "relative", width: tamanho, height: tamanho, flex: "none" }}>
      <svg width={tamanho} height={tamanho} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={tamanho / 2} cy={tamanho / 2} r={raio} fill="none" stroke={COLORS.ruleSoft} strokeWidth={espessura} />
        <circle
          cx={tamanho / 2}
          cy={tamanho / 2}
          r={raio}
          fill="none"
          stroke={corFinal}
          strokeWidth={espessura}
          strokeLinecap="round"
          strokeDasharray={perimetro}
          strokeDashoffset={perimetro - (perimetro * desenhado) / 100}
          style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.25,0.1,0.25,1)" }}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          fontSize: tamanho > 56 ? 13 : 11,
          fontWeight: 700,
          color: COLORS.ink,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {rotulo !== undefined ? rotulo : `${Math.round(valor)}%`}
      </div>
    </div>
  );
}

// Blocos cinzentos com brilho a passar, na forma do conteúdo que vai chegar.
function Esqueleto({ altura = 14, largura = "100%", radius = 6, style }) {
  return <div className="shimmer" style={{ height: altura, width: largura, borderRadius: radius, ...style }} />;
}

function EsqueletoPagina() {
  return (
    <div>
      <div style={{ display: "flex", gap: 14, marginBottom: 20, flexWrap: "wrap" }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{ ...panelStyle, flex: 1, minWidth: 140 }}>
            <Esqueleto altura={11} largura="60%" />
            <Esqueleto altura={24} largura="45%" style={{ marginTop: 10 }} />
          </div>
        ))}
      </div>
      <div style={{ ...panelStyle, marginBottom: 16 }}>
        <Esqueleto altura={12} largura={160} />
        <Esqueleto altura={190} radius={10} style={{ marginTop: 14 }} />
      </div>
      <div style={panelStyle}>
        <Esqueleto altura={12} largura={120} />
        {[0, 1, 2, 3, 4].map((i) => (
          <Esqueleto key={i} altura={16} style={{ marginTop: 12 }} />
        ))}
      </div>
    </div>
  );
}

// Estado vazio com ícone, explicação e, quando faz sentido, uma ação.
function Vazio({ icon: Icon, titulo, texto, acao, onAcao }) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "48px 24px",
        background: COLORS.paperRaised,
        border: `1px solid ${COLORS.rule}`,
        borderRadius: 14,
      }}
    >
      {Icon && (
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            background: COLORS.navyWash,
            display: "grid",
            placeItems: "center",
            margin: "0 auto 14px",
          }}
        >
          <Icon size={22} color={COLORS.navySoft} />
        </div>
      )}
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 5 }}>{titulo}</div>
      {texto && <div style={{ fontSize: 13, color: COLORS.ink2, maxWidth: 360, margin: "0 auto", lineHeight: 1.55 }}>{texto}</div>}
      {acao && onAcao && (
        <button className="press" onClick={onAcao} style={{ ...primaryBtnStyle, flex: "none", padding: "9px 16px", marginTop: 16 }}>
          {acao}
        </button>
      )}
    </div>
  );
}

// Tooltip dos gráficos, com o desenho da app em vez do padrão do Recharts.
function DicaGrafico({ active, payload, label, sufixo }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div
      style={{
        background: COLORS.paperRaised,
        border: `1px solid ${COLORS.rule}`,
        borderRadius: 10,
        padding: "9px 12px",
        boxShadow: COLORS.lift,
        fontSize: 12.5,
      }}
    >
      {label !== undefined && <div style={{ fontWeight: 600, marginBottom: 6, color: COLORS.ink }}>{label}</div>}
      {payload
        .filter((p) => p.value !== null && p.value !== undefined)
        .map((p, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 7, marginTop: i ? 3 : 0 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: p.color || p.fill, flex: "none" }} />
            <span style={{ color: COLORS.ink2 }}>{p.name}</span>
            <strong style={{ marginLeft: "auto", color: COLORS.ink, fontVariantNumeric: "tabular-nums" }}>
              {typeof p.value === "number" ? Math.abs(p.value).toLocaleString("pt-PT") : p.value}
              {sufixo || ""}
            </strong>
          </div>
        ))}
    </div>
  );
}

// ---------- Notificações flutuantes ----------
function Notificacoes({ lista, onFechar }) {
  return (
    <div
      style={{
        position: "fixed",
        bottom: 20,
        right: 20,
        zIndex: 90,
        display: "flex",
        flexDirection: "column",
        gap: 9,
        maxWidth: "min(380px, calc(100vw - 40px))",
      }}
    >
      {lista.map((n) => {
        const cor = n.tipo === "erro" ? COLORS.danger : n.tipo === "aviso" ? COLORS.warn : COLORS.ok;
        const fundo = n.tipo === "erro" ? COLORS.dangerBg : n.tipo === "aviso" ? COLORS.warnBg : COLORS.okBg;
        const Icone = n.tipo === "erro" ? AlertTriangle : n.tipo === "aviso" ? AlertTriangle : Check;
        return (
          <div
            key={n.id}
            className="toastIn"
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              background: COLORS.paperRaised,
              border: `1px solid ${COLORS.rule}`,
              borderRadius: 12,
              padding: "11px 13px",
              boxShadow: COLORS.lift,
            }}
          >
            <div style={{ width: 22, height: 22, borderRadius: 7, background: fundo, display: "grid", placeItems: "center", flex: "none", marginTop: 1 }}>
              <Icone size={13} color={cor} />
            </div>
            <div style={{ flex: 1, fontSize: 13, lineHeight: 1.45 }}>{n.texto}</div>
            <button onClick={() => onFechar(n.id)} style={{ ...iconBtnStyle, padding: 0, marginTop: 2 }} aria-label="Fechar">
              <X size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ---------- Stat card ----------
function StatCard({ label, value, color, subtitle, anel }) {
  return (
    <div
      className="liftable"
      style={{
        background: COLORS.paperRaised,
        border: `1px solid ${COLORS.rule}`,
        borderRadius: 14,
        padding: "14px 16px",
        flex: 1,
        minWidth: 140,
        boxShadow: COLORS.shadow,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 12, color: COLORS.ink2, fontWeight: 500 }}>{label}</div>
          <div
            style={{
              fontSize: 24,
              fontWeight: 600,
              letterSpacing: "-0.03em",
              color: color || COLORS.ink,
              lineHeight: 1,
              marginTop: 7,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            <Contador valor={value} />
          </div>
          {subtitle && <div style={{ fontSize: 11.5, color: COLORS.slate, marginTop: 6 }}>{subtitle}</div>}
        </div>
        {anel !== null && anel !== undefined && (
          <AnelProgresso pct={anel} tamanho={52} espessura={5} cor={color} rotulo="" />
        )}
      </div>
    </div>
  );
}

// ---------- Gestor de uma lista ----------
// Abre a partir de cada "Gerir lista", mostrando apenas a lista daquele campo.
// Evita o menu único gigante com todas as listas da app lá dentro.
function GestorLista({ titulo, nota, itens, placeholder, emUso, onAdd, onRemove, onClose }) {
  const [novo, setNovo] = useState("");
  const [erro, setErro] = useState("");
  const lista = itens || [];

  const adicionar = () => {
    const v = novo.trim();
    if (!v) {
      setErro("Escreve o nome antes de adicionar.");
      return;
    }
    if (lista.some((x) => x.toLowerCase() === v.toLowerCase())) {
      setErro("Esse item já existe na lista.");
      return;
    }
    setErro("");
    onAdd(v);
    setNovo("");
  };

  const remover = (x) => {
    const usos = emUso ? emUso(x) : 0;
    if (usos > 0) {
      setErro(`"${x}" está a ser usado em ${usos} registo(s) e não pode ser removido.`);
      return;
    }
    setErro("");
    onRemove(x);
  };

  return (
    <div
      className="veil"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(8,14,24,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 70,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        className="sheet"
        style={{
          width: "min(460px, 100%)",
          maxHeight: "calc(100vh - 32px)",
          overflowY: "auto",
          background: COLORS.paperRaised,
          border: `1px solid ${COLORS.rule}`,
          borderRadius: 14,
          padding: "20px 22px 22px",
          boxShadow: "0 20px 50px -12px rgba(8,14,24,0.35)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 4 }}>
          <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.015em" }}>{titulo}</div>
          <button onClick={onClose} style={{ ...iconBtnStyle, padding: 0 }} aria-label="Fechar">
            <X size={17} />
          </button>
        </div>
        {nota && <div style={{ fontSize: 12.5, color: COLORS.ink2, lineHeight: 1.5, marginBottom: 16 }}>{nota}</div>}

        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <input
            type="text"
            autoFocus
            placeholder={placeholder || "Novo item"}
            value={novo}
            onChange={(e) => {
              setNovo(e.target.value);
              setErro("");
            }}
            onKeyDown={(e) => e.key === "Enter" && adicionar()}
            style={inputStyle}
          />
          <button className="press" onClick={adicionar} style={{ ...primaryBtnStyle, flex: "none", padding: "9px 15px" }}>
            Adicionar
          </button>
        </div>

        {lista.length === 0 ? (
          <div style={{ fontSize: 13, color: COLORS.slate, padding: "14px 0" }}>Lista vazia. Acrescenta o primeiro item acima.</div>
        ) : (
          <div style={{ border: `1px solid ${COLORS.rule}`, borderRadius: 10, overflow: "hidden" }}>
            {lista.map((x, i) => (
              <div
                key={x}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "9px 12px",
                  borderTop: i ? `1px solid ${COLORS.ruleSoft}` : "none",
                  fontSize: 13.5,
                }}
              >
                <span style={{ flex: 1 }}>{x}</span>
                {emUso && emUso(x) > 0 && (
                  <span style={{ fontSize: 11, color: COLORS.slate }}>{emUso(x)} em uso</span>
                )}
                <button onClick={() => remover(x)} style={{ ...iconBtnStyle, padding: 0 }} title="Remover">
                  <Trash2 size={14} color={COLORS.danger} />
                </button>
              </div>
            ))}
          </div>
        )}

        {erro && <div style={{ color: COLORS.danger, fontSize: 13, marginTop: 12 }}>{erro}</div>}
      </div>
    </div>
  );
}

// ---------- Manage schools/categories modal ----------

// ---------- Complaint detail / notes timeline ----------
function ComplaintDetail({ entry, onClose, onAddNote, onStart, onDone, onReopen }) {
  const [note, setNote] = useState("");
  const [concluding, setConcluding] = useState(false);
  const [responseText, setResponseText] = useState(entry.responseText || "");
  const [eficacia, setEficacia] = useState(entry.eficacia || "");
  const [resolvedOn, setResolvedOn] = useState(
    entry.resolvedDate ? new Date(entry.resolvedDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)
  );
  const [startedOn, setStartedOn] = useState(entry.startedDate ? new Date(entry.startedDate).toISOString().slice(0, 10) : "");
  const notes = [...(entry.notes || [])].sort((a, b) => new Date(b.date) - new Date(a.date));

  // Se a reclamação mudar (ou for atualizada após guardar), repõe os campos do
  // formulário a partir do que está realmente gravado.
  useEffect(() => {
    setResponseText(entry.responseText || "");
    setEficacia(entry.eficacia || "");
    setResolvedOn(
      entry.resolvedDate ? new Date(entry.resolvedDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)
    );
    setStartedOn(entry.startedDate ? new Date(entry.startedDate).toISOString().slice(0, 10) : "");
  }, [entry.id, entry.responseText, entry.eficacia, entry.resolvedDate, entry.startedDate]);

  const submit = () => {
    const v = note.trim();
    if (!v) return;
    onAddNote(entry.id, v);
    setNote("");
  };

  const confirmDone = () => {
    const isEditing = entry.derivedStatus === "concluido";
    onDone(entry.id, { responseText: responseText.trim(), eficacia, resolvedDate: resolvedOn, startedDate: startedOn || null }, isEditing);
  };

  return (
    <div
      className="veil"
      style={{ position: "fixed", inset: 0, background: "rgba(8,14,24,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 55, padding: 16 }}
      onClick={onClose}
    >
      <div
        className="sheet"
        style={{ width: "min(560px, 100%)", maxHeight: "calc(100vh - 32px)", overflowY: "auto", background: COLORS.paperRaised, borderRadius: 14, padding: "22px 22px 24px", border: `1px solid ${COLORS.rule}`, boxShadow: "0 20px 50px -12px rgba(8,14,24,0.35)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
          <div style={{ fontVariantNumeric: "tabular-nums", fontSize: 12, color: COLORS.slate, letterSpacing: "0.08em" }}>
            ENTRADA Nº {String(entry.entryNumber).padStart(4, "0")}
          </div>
          <button onClick={onClose} style={iconBtnStyle}>
            <X size={18} />
          </button>
        </div>
        <h2 style={{ margin: "0 0 12px", fontSize: 20, color: COLORS.navy }}>{entry.complainant}</h2>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          <Stamp statusKey={entry.derivedStatus} />
          {entry.severity && (
            <Tag label={`Gravidade: ${SEVERITY_META[entry.severity].label}`} color={SEVERITY_META[entry.severity].color} bg={SEVERITY_META[entry.severity].bg} />
          )}
          {entry.categoria && (
            <Tag label={entry.categoria} color={colorForLabel(entry.categoria).color} bg={colorForLabel(entry.categoria).bg} />
          )}
          {entry.canal && CANAL_META[entry.canal] && (
            <Tag label={CANAL_META[entry.canal].label} color={CANAL_META[entry.canal].color} bg={CANAL_META[entry.canal].bg} />
          )}
          {entry.eficacia && EFICACIA_META[entry.eficacia] && (
            <Tag label={`Eficácia: ${EFICACIA_META[entry.eficacia].label}`} color={EFICACIA_META[entry.eficacia].color} bg={EFICACIA_META[entry.eficacia].bg} />
          )}
        </div>

        <div style={{ fontSize: 12.5, color: COLORS.slate, marginBottom: 14, lineHeight: 1.6 }}>
          {entry.school || "sem escola"} · {entry.tema || "sem tema"} <br />
          {entry.epoca ? `Época ${entry.epoca} · ` : ""}Receção: {fmt(new Date(entry.receivedDate + "T00:00:00"))} · Prazo: {fmt(new Date(entry.deadline))}
          {entry.resolvedDate && ` · Concluída: ${fmt(new Date(entry.resolvedDate))}`}
        </div>

        {entry.emailLink && (
          <a
            href={entry.emailLink}
            target="_blank"
            rel="noreferrer"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: COLORS.navySoft, marginBottom: 14, textDecoration: "underline" }}
          >
            <Mail size={13} /> Abrir e-mail original
          </a>
        )}

        {entry.description && (
          <div style={{ fontSize: 13.5, marginBottom: 12, padding: "10px 12px", background: COLORS.paper, borderRadius: 4, border: `1px solid ${COLORS.rule}` }}>
            {entry.description}
          </div>
        )}

        {entry.context && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.slate, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
              Contexto adicional
            </div>
            <div style={{ fontSize: 13, color: COLORS.slate, whiteSpace: "pre-wrap" }}>{entry.context}</div>
          </div>
        )}

        {entry.status === "concluido" && entry.responseText && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.ok, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
              Resposta dada à reclamação
            </div>
            <div style={{ fontSize: 13.5, padding: "10px 12px", background: COLORS.okBg, borderRadius: 4, border: `1px solid ${COLORS.ok}`, whiteSpace: "pre-wrap" }}>
              {entry.responseText}
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          {entry.status === "por_pegar" && (
            <button onClick={() => onStart(entry.id)} style={{ ...secondaryBtnStyle, flex: "none", padding: "7px 12px", fontSize: 12.5 }}>
              Iniciar
            </button>
          )}
          {entry.derivedStatus !== "concluido" ? (
            <button onClick={() => setConcluding((v) => !v)} style={{ ...secondaryBtnStyle, flex: "none", padding: "7px 12px", fontSize: 12.5 }}>
              Marcar concluído
            </button>
          ) : (
            <>
              <button onClick={() => setConcluding((v) => !v)} style={{ ...secondaryBtnStyle, flex: "none", padding: "7px 12px", fontSize: 12.5 }}>
                {concluding ? "Fechar edição" : "Editar conclusão"}
              </button>
              <button onClick={() => onReopen(entry.id)} style={{ ...secondaryBtnStyle, flex: "none", padding: "7px 12px", fontSize: 12.5 }}>
                Reabrir
              </button>
            </>
          )}
        </div>

        {concluding && (
          <div style={{ marginBottom: 20, padding: "12px 14px", background: COLORS.paper, border: `1.5px solid ${COLORS.navySoft}`, borderRadius: 5 }}>
            <label style={{ ...labelStyle, marginTop: 0 }}>Data de início do trabalho (opcional)</label>
            <input
              type="date"
              value={startedOn}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setStartedOn(e.target.value)}
              style={inputStyle}
            />
            <div style={{ fontSize: 11, color: COLORS.slate, marginTop: 4, marginBottom: 14 }}>
              Deixa em branco se não sabes — nesse caso esta reclamação não entra no "Tempo médio de resposta" da
              Análise. Preenche se souberes quando começaste a tratar do assunto (mesmo que já tenha sido).
            </div>

            <label style={labelStyle}>Data da resposta / conclusão</label>
            <input
              type="date"
              value={resolvedOn}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setResolvedOn(e.target.value)}
              style={inputStyle}
            />
            <div style={{ fontSize: 11, color: COLORS.slate, marginTop: 4 }}>
              Ajusta esta data ao registar reclamações antigas — é a partir dela que se calcula o tempo de resolução.
            </div>

            <label style={labelStyle}>Resposta dada à reclamação</label>
            <textarea
              rows={3}
              placeholder="O que foi respondido / decidido..."
              value={responseText}
              onChange={(e) => setResponseText(e.target.value)}
              style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
            />
            <label style={labelStyle}>Eficácia da resposta</label>
            <div style={{ display: "flex", gap: 6 }}>
              {Object.entries(EFICACIA_META).map(([key, meta]) => (
                <button
                  key={key}
                  onClick={() => setEficacia(key)}
                  style={{
                    flex: 1,
                    padding: "7px 6px",
                    borderRadius: 4,
                    border: `1.5px solid ${eficacia === key ? meta.color : COLORS.rule}`,
                    background: eficacia === key ? meta.bg : "transparent",
                    color: eficacia === key ? meta.color : COLORS.ink,
                    fontSize: 11.5,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {meta.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                confirmDone();
                if (entry.derivedStatus === "concluido") setConcluding(false);
              }}
              style={{ ...primaryBtnStyle, marginTop: 12, flex: "none", padding: "8px 16px" }}
            >
              {entry.derivedStatus === "concluido" ? "Guardar alterações" : "Confirmar conclusão"}
            </button>
          </div>
        )}

        <div style={{ fontSize: 11.5, fontWeight: 600, color: COLORS.slate, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
          O que já foi feito / o que falta fazer
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <textarea
            rows={2}
            placeholder="Ex: Contactado o reclamante por telefone; falta confirmar com a escola..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit", flex: 1 }}
          />
          <button onClick={submit} style={{ ...primaryBtnStyle, flex: "none", padding: "0 16px" }}>
            Adicionar
          </button>
        </div>

        {notes.length === 0 ? (
          <div style={{ fontSize: 13, color: COLORS.slate }}>Ainda sem notas.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {notes.map((n) => (
              <div key={n.id} style={{ borderLeft: `2.5px solid ${COLORS.navySoft}`, paddingLeft: 12 }}>
                <div style={{ fontSize: 11, fontVariantNumeric: "tabular-nums", color: COLORS.slate, marginBottom: 3 }}>
                  {new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(
                    new Date(n.date)
                  )}
                </div>
                <div style={{ fontSize: 13.5 }}>{n.text}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


// ---------- (recurrence lists superseded by AnalysisDashboard charts) ----------

function topCounts(entries, field) {
  const map = {};
  entries.forEach((e) => {
    const v = (e[field] || "").trim();
    if (!v) return;
    map[v] = (map[v] || 0) + 1;
  });
  return Object.entries(map).sort((a, b) => b[1] - a[1]);
}

const MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function monthlyData(entries) {
  const map = {};
  entries.forEach((e) => {
    if (!e.receivedDate) return;
    const d = new Date(e.receivedDate + "T00:00:00");
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    map[key] = (map[key] || 0) + 1;
  });
  return Object.entries(map)
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .slice(-12)
    .map(([key, total]) => {
      const [y, m] = key.split("-");
      return { month: `${MONTH_NAMES[parseInt(m, 10) - 1]} ${y.slice(2)}`, total };
    });
}

const ANALYSIS_PARAMS = [
  { key: "monthly", label: "Tendência mensal" },
  { key: "canal", label: "Canal de contacto" },
  { key: "status", label: "Estado" },
  { key: "categoria", label: "Categoria" },
  { key: "eficacia", label: "Eficácia da resposta" },
  { key: "tema", label: "Temas mais recorrentes" },
  { key: "escola", label: "Escolas mais recorrentes" },
];

function AnalysisDashboard({ withStatus, schoolOptions, categoryOptions, categoriaOptions }) {
  const [fSchool, setFSchool] = useState("todos");
  const [fTema, setFTema] = useState("todos");
  const [fCategoria, setFCategoria] = useState("todos");
  const [fCanal, setFCanal] = useState("todos");
  const [fGravidade, setFGravidade] = useState("todos");
  const [fEpoca, setFEpoca] = useState("todas");
  const [visibleParams, setVisibleParams] = useState(new Set(ANALYSIS_PARAMS.map((p) => p.key)));

  const toggleParam = (key) => {
    setVisibleParams((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const filtered = useMemo(
    () =>
      withStatus
        .filter((e) => (fSchool === "todos" ? true : e.school === fSchool))
        .filter((e) => (fTema === "todos" ? true : e.tema === fTema))
        .filter((e) => (fCategoria === "todos" ? true : e.categoria === fCategoria))
        .filter((e) => (fCanal === "todos" ? true : e.canal === fCanal))
        .filter((e) => (fGravidade === "todos" ? true : e.severity === fGravidade))
        .filter((e) => (fEpoca === "todas" ? true : e.epoca === fEpoca)),
    [withStatus, fSchool, fTema, fCategoria, fCanal, fGravidade, fEpoca]
  );

  const total = filtered.length;

  const monthly = useMemo(() => monthlyData(filtered), [filtered]);

  const canalData = useMemo(
    () =>
      Object.entries(CANAL_META).map(([key, meta]) => ({
        name: meta.label,
        value: filtered.filter((e) => e.canal === key).length,
        color: meta.color,
      })),
    [filtered]
  );

  const statusData = useMemo(
    () =>
      Object.keys(STATUS_META).map((key) => ({
        name: STATUS_META[key].label,
        value: filtered.filter((e) => e.derivedStatus === key).length,
        color: STATUS_META[key].color,
      })),
    [filtered]
  );

  const categoriaData = useMemo(
    () => topCounts(filtered, "categoria").map(([name, value]) => ({ name, value, color: colorForLabel(name).color })),
    [filtered]
  );

  const eficaciaData = useMemo(
    () =>
      Object.entries(EFICACIA_META).map(([key, meta]) => ({
        name: meta.label,
        value: filtered.filter((e) => e.eficacia === key).length,
        color: meta.color,
      })),
    [filtered]
  );

  const temaData = useMemo(() => topCounts(filtered, "tema").slice(0, 8).map(([name, value]) => ({ name, value })), [filtered]);
  const schoolData = useMemo(() => topCounts(filtered, "school").slice(0, 8).map(([name, value]) => ({ name, value })), [filtered]);

  const resolved = filtered.filter((e) => e.status === "concluido" && e.resolvedDate);
  const avgResolutionDays = resolved.length
    ? Math.round(
        resolved.reduce((sum, e) => sum + (new Date(e.resolvedDate) - new Date(e.receivedDate + "T00:00:00")) / 86400000, 0) /
          resolved.length
      )
    : null;
  const onTimeRate = resolved.length
    ? Math.round((resolved.filter((e) => new Date(e.resolvedDate) <= new Date(e.deadline)).length / resolved.length) * 100)
    : null;

  const responded = filtered.filter((e) => e.startedDate);
  const avgResponseDays = responded.length
    ? Math.round(
        (responded.reduce((sum, e) => sum + (new Date(e.startedDate) - new Date(e.receivedDate + "T00:00:00")) / 86400000, 0) /
          responded.length) *
          10
      ) / 10
    : null;

  const filterSelectStyle = { ...inputStyle, width: 180 };

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <select value={fEpoca} onChange={(e) => setFEpoca(e.target.value)} style={filterSelectStyle}>
          <option value="todas">Todas as épocas</option>
          {[...new Set(withStatus.map((e) => e.epoca).filter(Boolean))].sort().reverse().map((ep) => (
            <option key={ep} value={ep}>
              Época {ep}
            </option>
          ))}
        </select>
        <select value={fSchool} onChange={(e) => setFSchool(e.target.value)} style={filterSelectStyle}>
          <option value="todos">Todas as escolas</option>
          {schoolOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select value={fTema} onChange={(e) => setFTema(e.target.value)} style={filterSelectStyle}>
          <option value="todos">Todos os temas</option>
          {categoryOptions.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select value={fCategoria} onChange={(e) => setFCategoria(e.target.value)} style={filterSelectStyle}>
          <option value="todos">Todas as categorias</option>
          {categoriaOptions.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select value={fCanal} onChange={(e) => setFCanal(e.target.value)} style={filterSelectStyle}>
          <option value="todos">Todos os canais</option>
          {Object.entries(CANAL_META).map(([key, meta]) => (
            <option key={key} value={key}>
              {meta.label}
            </option>
          ))}
        </select>
        <select value={fGravidade} onChange={(e) => setFGravidade(e.target.value)} style={filterSelectStyle}>
          <option value="todos">Todas as gravidades</option>
          {Object.entries(SEVERITY_META).map(([key, meta]) => (
            <option key={key} value={key}>
              {meta.label}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.slate, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
          Parâmetros de análise mostrados
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {ANALYSIS_PARAMS.map((p) => {
            const active = visibleParams.has(p.key);
            return (
              <button
                key={p.key}
                onClick={() => toggleParam(p.key)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 20,
                  border: `1.5px solid ${active ? COLORS.navy : COLORS.rule}`,
                  background: active ? COLORS.navy : "transparent",
                  color: active ? COLORS.onAccent : COLORS.slate,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {active ? "✓ " : "+ "}
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {total === 0 ? (
        <Vazio
          icon={Search}
          titulo="Nenhuma reclamação corresponde aos filtros"
          texto="Experimenta alargar o período ou limpar algum dos filtros acima."
        />
      ) : (
        <>
          <div style={{ display: "flex", gap: 14, marginBottom: 20, flexWrap: "wrap" }}>
            <StatCard label="Total de reclamações" value={total} />
            <StatCard
              label="Tempo médio de resposta"
              value={avgResponseDays !== null ? `${avgResponseDays} d` : "—"}
              color={COLORS.progress}
              subtitle="receção → início do trabalho"
            />
            <StatCard
              label="Tempo médio de resolução"
              value={avgResolutionDays !== null ? `${avgResolutionDays} d` : "—"}
              subtitle="receção → conclusão"
            />
            <StatCard
              label="Resolvidas dentro do prazo"
              value={onTimeRate !== null ? `${onTimeRate}%` : "—"}
              color={COLORS.ok}
              anel={onTimeRate}
            />
          </div>

          {visibleParams.has("monthly") && (
            <div style={{ ...panelStyle, marginBottom: 16 }}>
              <div style={panelTitle}>Reclamações por mês (últimos 12 meses)</div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={monthly}>
                  <defs>
                    <linearGradient id="gradAcento" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={COLORS.navy} stopOpacity="0.28" />
                      <stop offset="100%" stopColor={COLORS.navy} stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={COLORS.ruleSoft} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: COLORS.slate }} axisLine={{ stroke: COLORS.rule }} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: COLORS.slate }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip content={<DicaGrafico />} cursor={{ stroke: COLORS.rule }} />
                  <Area
                    type="monotone"
                    dataKey="total"
                    name="Reclamações"
                    stroke={COLORS.navy}
                    strokeWidth={2.5}
                    fill="url(#gradAcento)"
                    dot={{ r: 3, fill: COLORS.navy, strokeWidth: 0 }}
                    activeDot={{ r: 5, strokeWidth: 2, stroke: COLORS.paperRaised }}
                    animationDuration={900}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
            {visibleParams.has("canal") && (
              <div style={{ ...panelStyle, flex: "1 1 260px" }}>
                <div style={panelTitle}>Distribuição por canal de contacto</div>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={canalData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>
                      {canalData.map((d, i) => (
                        <Cell key={i} fill={d.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<DicaGrafico />} cursor={{ fill: COLORS.ruleSoft }} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: "flex", justifyContent: "center", gap: 12, fontSize: 11.5, marginTop: 4, flexWrap: "wrap" }}>
                  {canalData.map((d) => (
                    <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <span style={{ width: 9, height: 9, borderRadius: 2, background: d.color, display: "inline-block" }} />
                      {d.name} ({d.value})
                    </div>
                  ))}
                </div>
              </div>
            )}

            {visibleParams.has("status") && (
              <div style={{ ...panelStyle, flex: "1 1 260px" }}>
                <div style={panelTitle}>Distribuição por estado</div>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>
                      {statusData.map((d, i) => (
                        <Cell key={i} fill={d.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<DicaGrafico />} cursor={{ fill: COLORS.ruleSoft }} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: "flex", justifyContent: "center", gap: 12, fontSize: 11.5, marginTop: 4, flexWrap: "wrap" }}>
                  {statusData.map((d) => (
                    <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <span style={{ width: 9, height: 9, borderRadius: 2, background: d.color, display: "inline-block" }} />
                      {d.name} ({d.value})
                    </div>
                  ))}
                </div>
              </div>
            )}

            {visibleParams.has("categoria") && (
              <div style={{ ...panelStyle, flex: "1 1 260px" }}>
                <div style={panelTitle}>Distribuição por categoria</div>
                {categoriaData.length === 0 ? (
                  <div style={{ fontSize: 13, color: COLORS.slate }}>Sem dados de categoria ainda.</div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={categoriaData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>
                          {categoriaData.map((d, i) => (
                            <Cell key={i} fill={d.color} />
                          ))}
                        </Pie>
                        <Tooltip content={<DicaGrafico />} cursor={{ fill: COLORS.ruleSoft }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ display: "flex", justifyContent: "center", gap: 12, fontSize: 11, marginTop: 4, flexWrap: "wrap" }}>
                      {categoriaData.map((d) => (
                        <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <span style={{ width: 9, height: 9, borderRadius: 2, background: d.color, display: "inline-block" }} />
                          {d.name} ({d.value})
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {visibleParams.has("eficacia") && (
              <div style={{ ...panelStyle, flex: "1 1 260px" }}>
                <div style={panelTitle}>Eficácia da resposta (concluídas)</div>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={eficaciaData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>
                      {eficaciaData.map((d, i) => (
                        <Cell key={i} fill={d.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<DicaGrafico />} cursor={{ fill: COLORS.ruleSoft }} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: "flex", justifyContent: "center", gap: 12, fontSize: 11.5, marginTop: 4, flexWrap: "wrap" }}>
                  {eficaciaData.map((d) => (
                    <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <span style={{ width: 9, height: 9, borderRadius: 2, background: d.color, display: "inline-block" }} />
                      {d.name} ({d.value})
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {visibleParams.has("tema") && (
              <div style={{ ...panelStyle, flex: "1 1 320px" }}>
                <div style={panelTitle}>Temas mais recorrentes</div>
                {temaData.length === 0 ? (
                  <div style={{ fontSize: 13, color: COLORS.slate }}>Sem dados de tema ainda.</div>
                ) : (
                  <ResponsiveContainer width="100%" height={Math.max(160, temaData.length * 32)}>
                    <BarChart data={temaData} layout="vertical" margin={{ left: 8 }}>
                      <CartesianGrid stroke={COLORS.ruleSoft} strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: COLORS.slate }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 12, fill: COLORS.ink }} axisLine={false} tickLine={false} />
                      <Tooltip content={<DicaGrafico />} cursor={{ fill: COLORS.ruleSoft }} />
                      <Bar dataKey="value" fill={COLORS.navySoft} radius={[0, 3, 3, 0]} barSize={16} animationDuration={800} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            )}

            {visibleParams.has("escola") && (
              <div style={{ ...panelStyle, flex: "1 1 320px" }}>
                <div style={panelTitle}>Escolas mais recorrentes</div>
                {schoolData.length === 0 ? (
                  <div style={{ fontSize: 13, color: COLORS.slate }}>Sem dados de escola ainda.</div>
                ) : (
                  <ResponsiveContainer width="100%" height={Math.max(160, schoolData.length * 32)}>
                    <BarChart data={schoolData} layout="vertical" margin={{ left: 8 }}>
                      <CartesianGrid stroke={COLORS.ruleSoft} strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: COLORS.slate }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 12, fill: COLORS.ink }} axisLine={false} tickLine={false} />
                      <Tooltip content={<DicaGrafico />} cursor={{ fill: COLORS.ruleSoft }} />
                      <Bar dataKey="value" fill={COLORS.navy} radius={[0, 3, 3, 0]} barSize={16} animationDuration={800} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}




// ---------- New audit form ----------
function AuditForm({ schoolOptions, onCancel, onSave, onGerirLista }) {
  const [school, setSchool] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  return (
    <div
      className="veil"
      style={{ position: "fixed", inset: 0, background: "rgba(8,14,24,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 55, padding: 16 }}
      onClick={onCancel}
    >
      <div
        className="sheet"
        style={{ width: "min(420px, 100%)", maxHeight: "calc(100vh - 32px)", overflowY: "auto", background: COLORS.paperRaised, borderRadius: 14, padding: "22px 22px 24px", border: `1px solid ${COLORS.rule}`, boxShadow: "0 20px 50px -12px rgba(8,14,24,0.35)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
          <h2 style={{ margin: 0, fontSize: 20, color: COLORS.navy }}>Nova auditoria</h2>
          <button onClick={onCancel} style={iconBtnStyle}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <label style={{ ...labelStyle, marginTop: 0 }}>Escola</label>
          <button type="button" onClick={() => onGerirLista("schools")} style={{ ...linkBtnStyle, marginTop: 0 }}>
            Gerir lista
          </button>
        </div>
        <select value={school} onChange={(e) => setSchool(e.target.value)} style={inputStyle}>
          <option value="">{schoolOptions.length ? "Selecionar escola..." : "Sem escolas — usa 'Gerir lista'"}</option>
          {schoolOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <label style={labelStyle}>Data da auditoria</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle} />

        <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
          <button onClick={onCancel} style={secondaryBtnStyle}>
            Cancelar
          </button>
          <button
            onClick={() => {
              if (!school) return;
              onSave({ id: `a_${Date.now()}`, school, date, findings: [] });
            }}
            style={primaryBtnStyle}
          >
            Criar auditoria
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Audit detail: findings management ----------
function AuditDetail({
  audit,
  auditCategoryOptions,
  areaOptions,
  onClose,
  onAddFinding,
  onRemoveFinding,
  onUpdateFinding,
  onRemoveAudit,
  onGerirLista,
}) {
  const [classification, setClassification] = useState("NC");
  const [category, setCategory] = useState("");
  const [area, setArea] = useState("");
  const [description, setDescription] = useState("");
  const [acaoDraft, setAcaoDraft] = useState({});

  const submit = () => {
    const v = description.trim();
    if (!v) return;
    onAddFinding(audit.id, {
      id: `f_${Date.now()}`,
      classification,
      category,
      area,
      description: v,
      resolvida: false,
      eficacia: "",
      acao: "",
    });
    setDescription("");
  };

  const resolvidas = audit.findings.filter((f) => f.resolvida).length;

  return (
    <div
      className="veil"
      style={{ position: "fixed", inset: 0, background: "rgba(8,14,24,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 55, padding: 16 }}
      onClick={onClose}
    >
      <div
        className="sheet"
        style={{ width: "min(600px, 100%)", maxHeight: "calc(100vh - 32px)", overflowY: "auto", background: COLORS.paperRaised, borderRadius: 14, padding: "22px 22px 24px", border: `1px solid ${COLORS.rule}`, boxShadow: "0 20px 50px -12px rgba(8,14,24,0.35)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
          <div style={{ fontVariantNumeric: "tabular-nums", fontSize: 12, color: COLORS.slate, letterSpacing: "0.08em" }}>
            {fmt(new Date(audit.date + "T00:00:00"))}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button title="Eliminar auditoria" onClick={() => onRemoveAudit(audit.id)} style={iconBtnStyle}>
              <Trash2 size={16} color={COLORS.danger} />
            </button>
            <button onClick={onClose} style={iconBtnStyle}>
              <X size={18} />
            </button>
          </div>
        </div>
        <h2 style={{ margin: "0 0 4px", fontSize: 20, color: COLORS.navy }}>{audit.school}</h2>
        <div style={{ fontSize: 12.5, color: COLORS.slate, marginBottom: 18 }}>
          {audit.findings.length} constatações · {resolvidas} resolvidas
        </div>

        <div style={{ fontSize: 11.5, fontWeight: 600, color: COLORS.slate, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
          Nova constatação
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
          {Object.entries(CLASSIFICATION_META).map(([key, meta]) => (
            <button
              key={key}
              onClick={() => setClassification(key)}
              style={{
                padding: "6px 10px",
                borderRadius: 4,
                border: `1.5px solid ${classification === key ? meta.color : COLORS.rule}`,
                background: classification === key ? meta.bg : "transparent",
                color: classification === key ? meta.color : COLORS.ink,
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
              title={meta.label}
            >
              {key}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 12, color: COLORS.slate, marginBottom: 10 }}>{CLASSIFICATION_META[classification].label}</div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <label style={{ ...labelStyle, marginTop: 0 }}>Área / Departamento</label>
          <button type="button" onClick={() => onGerirLista("auditAreas")} style={{ ...linkBtnStyle, marginTop: 0 }}>
            Gerir lista
          </button>
        </div>
        <select value={area} onChange={(e) => setArea(e.target.value)} style={{ ...inputStyle, marginBottom: 10 }}>
          <option value="">{areaOptions.length ? "Selecionar área..." : "Sem áreas — usa 'Gerir lista'"}</option>
          {areaOptions.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <label style={{ ...labelStyle, marginTop: 0 }}>Categoria</label>
          <button type="button" onClick={() => onGerirLista("auditCategories")} style={{ ...linkBtnStyle, marginTop: 0 }}>
            Gerir lista
          </button>
        </div>
        <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ ...inputStyle, marginBottom: 10 }}>
          <option value="">{auditCategoryOptions.length ? "Selecionar categoria..." : "Sem categorias — usa 'Gerir lista'"}</option>
          {auditCategoryOptions.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <div style={{ display: "flex", gap: 8, marginBottom: 22 }}>
          <textarea
            rows={2}
            placeholder="Descrição da constatação..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit", flex: 1 }}
          />
          <button onClick={submit} style={{ ...primaryBtnStyle, flex: "none", padding: "0 16px" }}>
            Adicionar
          </button>
        </div>

        <div style={{ fontSize: 11.5, fontWeight: 600, color: COLORS.slate, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
          Constatações ({audit.findings.length})
        </div>
        {audit.findings.length === 0 ? (
          <div style={{ fontSize: 13, color: COLORS.slate }}>Ainda sem constatações registadas.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {audit.findings.map((f) => {
              const cm = CLASSIFICATION_META[f.classification] || CLASSIFICATION_META.NC;
              return (
                <div key={f.id} style={{ padding: "11px 13px", background: COLORS.paper, borderRadius: 4, border: `1px solid ${COLORS.rule}` }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <Tag label={f.classification} color={cm.color} bg={cm.bg} />
                    <div style={{ flex: 1 }}>
                      {(f.area || f.category) && (
                        <div style={{ fontSize: 11, color: COLORS.slate, marginBottom: 2 }}>
                          {[f.area, f.category].filter(Boolean).join(" · ")}
                        </div>
                      )}
                      <div style={{ fontSize: 13.5 }}>{f.description}</div>
                    </div>
                    <button title="Remover" onClick={() => onRemoveFinding(audit.id, f.id)} style={{ ...iconBtnStyle, padding: 0 }}>
                      <X size={14} />
                    </button>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: 7,
                      alignItems: "center",
                      flexWrap: "wrap",
                      marginTop: 10,
                      paddingTop: 10,
                      borderTop: `1px solid ${COLORS.rule}`,
                    }}
                  >
                    <span style={{ fontSize: 11.5, color: COLORS.slate, fontWeight: 600 }}>Resolvida?</span>
                    <button
                      onClick={() =>
                        onUpdateFinding(audit.id, f.id,
                          f.resolvida ? { resolvida: false, eficacia: "", acao: "" } : { resolvida: true, eficacia: f.eficacia || "eficaz" }
                        )
                      }
                      style={{
                        padding: "5px 12px",
                        borderRadius: 20,
                        border: `1.5px solid ${f.resolvida ? COLORS.ok : COLORS.rule}`,
                        background: f.resolvida ? COLORS.okBg : "transparent",
                        color: f.resolvida ? COLORS.ok : COLORS.slate,
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      {f.resolvida ? "✓ Sim" : "Não"}
                    </button>

                    {f.resolvida && (
                      <>
                        <span style={{ fontSize: 11.5, color: COLORS.slate, fontWeight: 600, marginLeft: 4 }}>Eficácia</span>
                        {Object.entries(EFICACIA_ACAO_META).map(([k, meta]) => (
                          <button
                            key={k}
                            onClick={() => onUpdateFinding(audit.id, f.id, { eficacia: k })}
                            style={{
                              padding: "5px 11px",
                              borderRadius: 20,
                              border: `1.5px solid ${f.eficacia === k ? meta.color : COLORS.rule}`,
                              background: f.eficacia === k ? meta.bg : "transparent",
                              color: f.eficacia === k ? meta.color : COLORS.slate,
                              fontSize: 11.5,
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            {f.eficacia === k ? "✓ " : ""}
                            {meta.label}
                          </button>
                        ))}
                      </>
                    )}
                  </div>

                  {f.resolvida && (
                    <div style={{ marginTop: 9 }}>
                      <label style={{ ...labelStyle, marginTop: 0 }}>Ação corretiva / correção aplicada</label>
                      <div style={{ display: "flex", gap: 8 }}>
                        <textarea
                          rows={2}
                          placeholder="O que foi feito para resolver..."
                          value={acaoDraft[f.id] !== undefined ? acaoDraft[f.id] : f.acao || ""}
                          onChange={(e) => setAcaoDraft((d) => ({ ...d, [f.id]: e.target.value }))}
                          style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit", flex: 1 }}
                        />
                        <button
                          onClick={() => {
                            onUpdateFinding(audit.id, f.id, { acao: (acaoDraft[f.id] !== undefined ? acaoDraft[f.id] : f.acao || "").trim() });
                            setAcaoDraft((d) => {
                              const n = { ...d };
                              delete n[f.id];
                              return n;
                            });
                          }}
                          style={{ ...primaryBtnStyle, flex: "none", padding: "0 14px" }}
                        >
                          Guardar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Quadrant matrix (shared by audits and enrolment analysis) ----------
function QuadrantMatrix({ subjects, metrics, defaultX, defaultY, label }) {
  const keys = Object.keys(metrics);
  const [mx, setMx] = useState(defaultX && metrics[defaultX] ? defaultX : keys[0]);
  const [my, setMy] = useState(defaultY && metrics[defaultY] ? defaultY : keys[1] || keys[0]);
  const MX = metrics[mx] || metrics[keys[0]];
  const MY = metrics[my] || metrics[keys[0]];

  const pts = subjects.map((s) => ({ x: MX.v(s), y: MY.v(s), name: s }));
  const median = (arr) => {
    if (!arr.length) return 0;
    const v = [...arr].sort((a, b) => a - b);
    const m = Math.floor(v.length / 2);
    return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
  };
  const cx = median(pts.map((p) => p.x));
  const cy = median(pts.map((p) => p.y));

  const quads = [
    { label: `${MX.label} baixo · ${MY.label} alto`, color: COLORS.ok, pts: pts.filter((p) => p.x < cx && p.y >= cy) },
    { label: `${MX.label} alto · ${MY.label} alto`, color: COLORS.warn, pts: pts.filter((p) => p.x >= cx && p.y >= cy) },
    { label: `${MX.label} baixo · ${MY.label} baixo`, color: COLORS.slate, pts: pts.filter((p) => p.x < cx && p.y < cy) },
    { label: `${MX.label} alto · ${MY.label} baixo`, color: COLORS.danger, pts: pts.filter((p) => p.x >= cx && p.y < cy) },
  ];
  const colorFor = (p) => (p.x >= cx && p.y >= cy ? COLORS.warn : p.x < cx && p.y >= cy ? COLORS.ok : p.x >= cx ? COLORS.danger : COLORS.slate);

  return (
    <div style={panelStyle}>
      <div style={panelTitle}>{label}</div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <div>
          <label style={{ ...labelStyle, marginTop: 0 }}>Eixo horizontal (X)</label>
          <select value={mx} onChange={(e) => setMx(e.target.value)} style={{ ...inputStyle, width: 240 }}>
            {keys.map((k) => (
              <option key={k} value={k}>
                {metrics[k].label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ ...labelStyle, marginTop: 0 }}>Eixo vertical (Y)</label>
          <select value={my} onChange={(e) => setMy(e.target.value)} style={{ ...inputStyle, width: 240 }}>
            {keys.map((k) => (
              <option key={k} value={k}>
                {metrics[k].label}
              </option>
            ))}
          </select>
        </div>
      </div>
      {pts.length === 0 ? (
        <div style={{ fontSize: 13, color: COLORS.slate }}>Sem dados para cruzar.</div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={320}>
            <ScatterChart margin={{ top: 14, right: 22, bottom: 30, left: 6 }}>
              <CartesianGrid stroke={COLORS.ruleSoft} strokeDasharray="3 3" />
              <XAxis
                type="number"
                dataKey="x"
                name={MX.label}
                tick={{ fontSize: 11, fill: COLORS.slate }}
                label={{ value: MX.label, position: "insideBottom", offset: -18, fontSize: 11, fill: COLORS.slate }}
              />
              <YAxis
                type="number"
                dataKey="y"
                name={MY.label}
                tick={{ fontSize: 11, fill: COLORS.slate }}
                label={{ value: MY.label, angle: -90, position: "insideLeft", fontSize: 11, fill: COLORS.slate }}
              />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 4, borderColor: COLORS.rule }}
                formatter={(v, n) => [n === "x" ? MX.fmt(v) : MY.fmt(v), n === "x" ? MX.label : MY.label]}
                labelFormatter={() => ""}
                content={({ payload }) => {
                  if (!payload || !payload.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div style={{ background: COLORS.paperRaised, color: COLORS.ink, border: `1px solid ${COLORS.rule}`, borderRadius: 8, padding: "7px 10px", fontSize: 12, boxShadow: COLORS.lift }}>
                      <strong>{d.name}</strong>
                      <div>
                        {MX.label}: {MX.fmt(d.x)}
                      </div>
                      <div>
                        {MY.label}: {MY.fmt(d.y)}
                      </div>
                    </div>
                  );
                }}
              />
              <ReferenceLine x={cx} stroke={COLORS.slate} strokeDasharray="5 4" />
              <ReferenceLine y={cy} stroke={COLORS.slate} strokeDasharray="5 4" />
              <Scatter data={pts}>
                {pts.map((p, i) => (
                  <Cell key={i} fill={colorFor(p)} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
            {quads.map((q) => (
              <div key={q.label} style={{ border: `1px solid ${COLORS.rule}`, borderLeft: `3px solid ${q.color}`, padding: "8px 10px" }}>
                <div style={{ fontSize: 11, color: COLORS.slate, marginBottom: 3 }}>{q.label}</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{q.pts.length ? q.pts.map((p) => p.name).join(", ") : "—"}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: COLORS.slate, marginTop: 8 }}>
            As linhas tracejadas marcam a mediana de cada eixo, por isso os quadrantes são uma comparação relativa entre
            escolas, não um padrão de qualidade absoluto.
          </div>
        </>
      )}
    </div>
  );
}

// ---------- Chart parameter toggles ----------
function ParamChips({ params, visible, onToggle }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.slate, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
        Parâmetros de análise mostrados
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {params.map((p) => {
          const on = visible.has(p.key);
          return (
            <button
              key={p.key}
              onClick={() => onToggle(p.key)}
              style={{
                padding: "6px 12px",
                borderRadius: 20,
                border: `1.5px solid ${on ? COLORS.navy : COLORS.rule}`,
                background: on ? COLORS.navy : "transparent",
                color: on ? COLORS.onAccent : COLORS.slate,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {on ? "✓ " : "+ "}
              {p.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const AUDIT_PARAMS = [
  { key: "catArea", label: "Categoria e área" },
  { key: "clsArea", label: "Classificação por área" },
  { key: "quad", label: "Matriz de quadrantes" },
  { key: "rank", label: "Ranking de escolas" },
  { key: "clsEsc", label: "Classificação por escola" },
  { key: "pend", label: "Por resolver" },
  { key: "estado", label: "Estado e eficácia" },
  { key: "totArea", label: "Total por área" },
];

// ---------- Audits analysis ----------
function AuditsAnalysis({ audits, schoolOptions, areaOptions, auditCategoryOptions }) {
  const [fEsc, setFEsc] = useState("todas");
  const [fArea, setFArea] = useState("todas");
  const [fCls, setFCls] = useState("todas");
  const [visible, setVisible] = useState(new Set(AUDIT_PARAMS.map((p) => p.key)));

  const toggle = (k) =>
    setVisible((prev) => {
      const n = new Set(prev);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });

  // Cada constatação leva consigo a escola e a data da auditoria a que pertence.
  const all = useMemo(
    () => audits.flatMap((a) => (a.findings || []).map((f) => ({ ...f, escola: a.school, data: a.date, auditId: a.id }))),
    [audits]
  );
  const F = useMemo(
    () =>
      all
        .filter((f) => (fEsc === "todas" ? true : f.escola === fEsc))
        .filter((f) => (fArea === "todas" ? true : f.area === fArea))
        .filter((f) => (fCls === "todas" ? true : f.classification === fCls)),
    [all, fEsc, fArea, fCls]
  );

  const escolas = useMemo(() => [...new Set(all.map((f) => f.escola))].sort(), [all]);
  const areas = useMemo(() => {
    const usadas = [...new Set(all.map((f) => f.area).filter(Boolean))];
    return [...new Set([...areaOptions, ...usadas])];
  }, [all, areaOptions]);
  const classes = Object.keys(CLASSIFICATION_META);

  const resolvidas = F.filter((f) => f.resolvida);
  const eficazes = resolvidas.filter((f) => f.eficacia === "eficaz");

  const catAreaData = useMemo(() => {
    const cats = [...new Set(F.map((f) => f.category).filter(Boolean))].slice(0, 10);
    return cats.map((c) => {
      const row = { name: c };
      areas.forEach((a) => (row[a] = F.filter((f) => f.category === c && f.area === a).length));
      return row;
    });
  }, [F, areas]);

  const clsAreaData = useMemo(
    () =>
      areas.map((a) => {
        const row = { name: a };
        classes.forEach((c) => (row[c] = F.filter((f) => f.area === a && f.classification === c).length));
        return row;
      }),
    [F, areas]
  );

  const rankData = useMemo(
    () =>
      escolas
        .map((e) => ({ name: e, value: F.filter((f) => f.escola === e).length }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10),
    [F, escolas]
  );

  const clsEscData = useMemo(
    () =>
      escolas.map((e) => {
        const row = { name: e };
        classes.forEach((c) => (row[c] = F.filter((f) => f.escola === e && f.classification === c).length));
        return row;
      }),
    [F, escolas]
  );

  const pendData = useMemo(
    () =>
      areas.map((a) => ({
        name: a,
        pendentes: F.filter((f) => f.area === a && !f.resolvida).length,
        graves: F.filter((f) => f.area === a && (f.classification === "NCM" || f.classification === "NC")).length,
      })),
    [F, areas]
  );

  const estadoData = useMemo(
    () =>
      classes.map((c) => ({
        name: c,
        eficaz: F.filter((f) => f.classification === c && f.resolvida && f.eficacia === "eficaz").length,
        parcial: F.filter((f) => f.classification === c && f.resolvida && f.eficacia === "parcial").length,
        ineficaz: F.filter((f) => f.classification === c && f.resolvida && f.eficacia === "ineficaz").length,
        pendente: F.filter((f) => f.classification === c && !f.resolvida).length,
      })),
    [F]
  );

  const totAreaData = useMemo(() => areas.map((a) => ({ name: a, value: F.filter((f) => f.area === a).length })), [F, areas]);

  const metrics = useMemo(
    () => ({
      constat: { label: "Nº de constatações", v: (e) => F.filter((f) => f.escola === e).length, fmt: (v) => v },
      graves: {
        label: "Graves (NCM+NC)",
        v: (e) => F.filter((f) => f.escola === e && (f.classification === "NCM" || f.classification === "NC")).length,
        fmt: (v) => v,
      },
      ncm: { label: "Não conformidades maiores", v: (e) => F.filter((f) => f.escola === e && f.classification === "NCM").length, fmt: (v) => v },
      om: { label: "Oportunidades de melhoria", v: (e) => F.filter((f) => f.escola === e && f.classification === "OM").length, fmt: (v) => v },
      as: { label: "Áreas sensíveis", v: (e) => F.filter((f) => f.escola === e && f.classification === "AS").length, fmt: (v) => v },
      pend: { label: "Por resolver", v: (e) => F.filter((f) => f.escola === e && !f.resolvida).length, fmt: (v) => v },
      taxares: {
        label: "Taxa de resolução (%)",
        v: (e) => {
          const t = F.filter((f) => f.escola === e);
          return t.length ? Math.round((t.filter((f) => f.resolvida).length / t.length) * 100) : 0;
        },
        fmt: (v) => v + "%",
      },
      eficacia: {
        label: "Eficácia das resoluções (%)",
        v: (e) => {
          const r = F.filter((f) => f.escola === e && f.resolvida);
          return r.length ? Math.round((r.filter((f) => f.eficacia === "eficaz").length / r.length) * 100) : 0;
        },
        fmt: (v) => v + "%",
      },
      ineficaz: { label: "Resoluções ineficazes", v: (e) => F.filter((f) => f.escola === e && f.resolvida && f.eficacia === "ineficaz").length, fmt: (v) => v },
      nareas: { label: "Nº de áreas afetadas", v: (e) => new Set(F.filter((f) => f.escola === e).map((f) => f.area).filter(Boolean)).size, fmt: (v) => v },
    }),
    [F]
  );

  const stackedBars = (data, keys, colors, height) => (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data}>
        <CartesianGrid stroke={COLORS.ruleSoft} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: COLORS.slate }} axisLine={{ stroke: COLORS.rule }} tickLine={false} interval={0} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: COLORS.slate }} axisLine={false} tickLine={false} width={28} />
        <Tooltip content={<DicaGrafico />} cursor={{ fill: COLORS.ruleSoft }} />
        {keys.map((k, i) => (
          <Bar key={k} dataKey={k} stackId="a" fill={colors[i]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );

  const legend = (items) => (
    <div style={{ display: "flex", justifyContent: "center", gap: 14, fontSize: 11.5, marginTop: 6, flexWrap: "wrap" }}>
      {items.map(([l, c]) => (
        <div key={l} style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 9, height: 9, borderRadius: 2, background: c, display: "inline-block" }} />
          {l}
        </div>
      ))}
    </div>
  );

  const filterStyle = { ...inputStyle, width: 190 };

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <select value={fEsc} onChange={(e) => setFEsc(e.target.value)} style={filterStyle}>
          <option value="todas">Todas as escolas</option>
          {escolas.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
        <select value={fArea} onChange={(e) => setFArea(e.target.value)} style={filterStyle}>
          <option value="todas">Todas as áreas</option>
          {areas.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <select value={fCls} onChange={(e) => setFCls(e.target.value)} style={filterStyle}>
          <option value="todas">Todas as classificações</option>
          {classes.map((c) => (
            <option key={c} value={c}>
              {c} — {CLASSIFICATION_META[c].label}
            </option>
          ))}
        </select>
      </div>

      <ParamChips params={AUDIT_PARAMS} visible={visible} onToggle={toggle} />

      {F.length === 0 ? (
        <Vazio
          icon={Search}
          titulo="Nenhuma constatação corresponde aos filtros"
          texto="Limpa os filtros de escola, área ou classificação para ver tudo."
        />
      ) : (
        <>
          <div style={{ display: "flex", gap: 14, marginBottom: 20, flexWrap: "wrap" }}>
            <StatCard label="Total de constatações" value={F.length} />
            <StatCard label="Escolas auditadas" value={new Set(F.map((f) => f.escola)).size} />
            <StatCard
              label="Resolvidas"
              value={resolvidas.length}
              color={COLORS.ok}
              subtitle={F.length ? `${Math.round((resolvidas.length / F.length) * 100)}% do total` : ""}
            />
            <StatCard
              label="Eficácia das resoluções"
              value={resolvidas.length ? `${Math.round((eficazes.length / resolvidas.length) * 100)}%` : "—"}
              subtitle="verificadas como eficazes"
              anel={resolvidas.length ? Math.round((eficazes.length / resolvidas.length) * 100) : null}
            />
          </div>

          {visible.has("catArea") && (
            <div style={{ ...panelStyle, marginBottom: 16 }}>
              <div style={panelTitle}>Incidência por categoria e área</div>
              {catAreaData.length === 0 ? (
                <div style={{ fontSize: 13, color: COLORS.slate }}>Sem categorias registadas nas constatações.</div>
              ) : (
                <>
                  {stackedBars(catAreaData, areas, areas.map((_, i) => TAG_PALETTE[i % TAG_PALETTE.length].color), 260)}
                  {legend(areas.map((a, i) => [a, TAG_PALETTE[i % TAG_PALETTE.length].color]))}
                </>
              )}
            </div>
          )}

          {visible.has("clsArea") && (
            <div style={{ ...panelStyle, marginBottom: 16 }}>
              <div style={panelTitle}>Classificações (NCM / NC / OM / AS) por área</div>
              {stackedBars(clsAreaData, classes, classes.map((c) => CLASSIFICATION_META[c].color), 260)}
              {legend(classes.map((c) => [`${c} — ${CLASSIFICATION_META[c].label}`, CLASSIFICATION_META[c].color]))}
            </div>
          )}

          {visible.has("quad") && (
            <div style={{ marginBottom: 16 }}>
              <QuadrantMatrix
                subjects={escolas}
                metrics={metrics}
                defaultX="constat"
                defaultY="taxares"
                label="Matriz de quadrantes — cruzar duas métricas de auditoria por escola"
              />
            </div>
          )}

          <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
            {visible.has("rank") && (
              <div style={{ ...panelStyle, flex: "1 1 320px" }}>
                <div style={panelTitle}>Ranking de escolas por constatações</div>
                <ResponsiveContainer width="100%" height={Math.max(180, rankData.length * 34)}>
                  <BarChart data={rankData} layout="vertical" margin={{ left: 8 }}>
                    <CartesianGrid stroke={COLORS.ruleSoft} strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: COLORS.slate }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 12, fill: COLORS.ink }} axisLine={false} tickLine={false} />
                    <Tooltip content={<DicaGrafico />} cursor={{ fill: COLORS.ruleSoft }} />
                    <Bar dataKey="value" fill={COLORS.navy} radius={[0, 3, 3, 0]} barSize={16} animationDuration={800} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {visible.has("clsEsc") && (
              <div style={{ ...panelStyle, flex: "1 1 320px" }}>
                <div style={panelTitle}>Classificação por escola</div>
                {stackedBars(clsEscData, classes, classes.map((c) => CLASSIFICATION_META[c].color), 260)}
                {legend(classes.map((c) => [c, CLASSIFICATION_META[c].color]))}
              </div>
            )}
          </div>

          {visible.has("pend") && (
            <div style={{ ...panelStyle, marginBottom: 16 }}>
              <div style={panelTitle}>Constatações por resolver, por área</div>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={pendData}>
                  <CartesianGrid stroke={COLORS.ruleSoft} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: COLORS.slate }} axisLine={{ stroke: COLORS.rule }} tickLine={false} interval={0} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: COLORS.slate }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip content={<DicaGrafico />} cursor={{ fill: COLORS.ruleSoft }} />
                  <Bar dataKey="pendentes" name="Por resolver" fill={COLORS.slate} radius={[3, 3, 0, 0]} animationDuration={800} />
                  <Bar dataKey="graves" name="NCM + NC" fill={COLORS.danger} radius={[3, 3, 0, 0]} animationDuration={800} />
                </BarChart>
              </ResponsiveContainer>
              {legend([
                ["Por resolver", COLORS.slate],
                ["NCM + NC (gravidade)", COLORS.danger],
              ])}
            </div>
          )}

          {visible.has("estado") && (
            <div style={{ ...panelStyle, marginBottom: 16 }}>
              <div style={panelTitle}>Estado das constatações por classificação</div>
              {stackedBars(estadoData, ["eficaz", "parcial", "ineficaz", "pendente"], [COLORS.ok, COLORS.warn, COLORS.danger, COLORS.slate], 250)}
              {legend([
                ["Eficaz", COLORS.ok],
                ["Parcialmente eficaz", COLORS.warn],
                ["Ineficaz", COLORS.danger],
                ["Por resolver", COLORS.slate],
              ])}
            </div>
          )}

          {visible.has("totArea") && (
            <div style={panelStyle}>
              <div style={panelTitle}>Total de constatações por área</div>
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={totAreaData}>
                  <CartesianGrid stroke={COLORS.ruleSoft} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: COLORS.slate }} axisLine={{ stroke: COLORS.rule }} tickLine={false} interval={0} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: COLORS.slate }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip content={<DicaGrafico />} cursor={{ fill: COLORS.ruleSoft }} />
                  <Bar dataKey="value" fill={COLORS.navy} radius={[3, 3, 0, 0]} barSize={34} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---------- Audits page (registo + análise) ----------
function AuditsPage({ audits, onNewAudit, onOpenAudit, schoolOptions, areaOptions, auditCategoryOptions }) {
  const [view, setView] = useState("registo");

  const sorted = [...audits].sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <div>
      <div
        style={{
          display: "inline-flex",
          gap: 3,
          background: COLORS.segTrack,
          border: "none",
          borderRadius: 9,
          padding: 2,
          marginBottom: 20,
          flexWrap: "wrap",
        }}
      >
        {[
          ["registo", "Registo"],
          ["analise", "Análise"],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setView(key)}
            className="pill"
            style={{
              background: view === key ? COLORS.paperRaised : "transparent",
              border: "none",
              borderRadius: 7,
              padding: "7px 14px",
              fontSize: 13.5,
              fontWeight: view === key ? 600 : 500,
              color: view === key ? COLORS.ink : COLORS.ink2,
              cursor: "pointer",
              boxShadow: view === key ? "0 1px 3px rgba(0,0,0,0.12)" : "none",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div key={view} className="pageIn">
      {view === "analise" ? (
        <AuditsAnalysis audits={audits} schoolOptions={schoolOptions} areaOptions={areaOptions} auditCategoryOptions={auditCategoryOptions} />
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
            <button
              onClick={onNewAudit}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: COLORS.navy,
                color: COLORS.onAccent,
                border: "none",
                borderRadius: 4,
                padding: "10px 16px",
                fontWeight: 700,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              <Plus size={16} /> Nova auditoria
            </button>
          </div>

          {sorted.length === 0 ? (
            <Vazio
              icon={ClipboardList}
              titulo="Ainda sem auditorias"
              texto="Registas a auditoria e depois vais acrescentando as constatações, com classificação, área e ação corretiva."
              acao="Nova auditoria"
              onAcao={onNewAudit}
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {sorted.map((a) => {
                const fs = a.findings || [];
                const pend = fs.filter((f) => !f.resolvida).length;
                return (
                  <div
                    key={a.id}
                    onClick={() => onOpenAudit(a)}
                    style={{
                      background: COLORS.paperRaised,
                      border: `1px solid ${COLORS.rule}`,
                      borderRadius: 6,
                      padding: "13px 16px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 10,
                      flexWrap: "wrap",
                      cursor: "pointer",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14.5 }}>{a.school}</div>
                      <div style={{ fontSize: 12, color: COLORS.slate, fontVariantNumeric: "tabular-nums" }}>
                        {fmt(new Date(a.date + "T00:00:00"))} · {fs.length} constatações
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {Object.keys(CLASSIFICATION_META).map((c) => {
                        const n = fs.filter((f) => f.classification === c).length;
                        if (!n) return null;
                        return <Tag key={c} label={`${n} ${c}`} color={CLASSIFICATION_META[c].color} bg={CLASSIFICATION_META[c].bg} />;
                      })}
                      {fs.length > 0 &&
                        (pend ? (
                          <Tag label={`${pend} por resolver`} color={COLORS.warn} bg={COLORS.warnBg} />
                        ) : (
                          <Tag label="todas resolvidas" color={COLORS.ok} bg={COLORS.okBg} />
                        ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
      </div>
    </div>
  );
}

// ---------- Sanções: novo registo de ocorrência ----------
function SanctionForm({ onCancel, onSave, schoolOptions, complaints, sanctionTypes, onGerirLista }) {
  const [form, setForm] = useState({
    personType: "familia",
    personName: "",
    school: "",
    motivo: "ma_conduta",
    date: new Date().toISOString().slice(0, 10),
    description: "",
    sanctionApplied: null,
    sanctionType: "",
    sanctionDescription: "",
    relatedComplaintId: "",
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div
      className="veil"
      style={{ position: "fixed", inset: 0, background: "rgba(8,14,24,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 55, padding: 16 }}
      onClick={onCancel}
    >
      <div
        className="sheet"
        style={{ width: "min(460px, 100%)", maxHeight: "calc(100vh - 32px)", overflowY: "auto", background: COLORS.paperRaised, borderRadius: 14, padding: "22px 22px 24px", border: `1px solid ${COLORS.rule}`, boxShadow: "0 20px 50px -12px rgba(8,14,24,0.35)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
          <h2 style={{ margin: 0, fontSize: 20, color: COLORS.navy }}>Nova ocorrência</h2>
          <button onClick={onCancel} style={iconBtnStyle}>
            <X size={18} />
          </button>
        </div>

        <label style={{ ...labelStyle, marginTop: 0 }}>Quem está envolvido</label>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {Object.entries(PERSON_TYPE_META).map(([key, meta]) => (
            <button
              key={key}
              onClick={() => setForm((f) => ({ ...f, personType: key }))}
              style={{
                flex: 1,
                padding: "10px 8px",
                borderRadius: 4,
                border: `1.5px solid ${form.personType === key ? COLORS.navy : COLORS.rule}`,
                background: form.personType === key ? COLORS.navy : "transparent",
                color: form.personType === key ? COLORS.onAccent : COLORS.ink,
                fontSize: 12.5,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {meta.label}
            </button>
          ))}
        </div>

        <label style={labelStyle}>Nome</label>
        <input type="text" placeholder="Nome da pessoa envolvida" value={form.personName} onChange={set("personName")} style={inputStyle} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <label style={{ ...labelStyle }}>Escola (opcional)</label>
          <button type="button" onClick={() => onGerirLista("schools")} style={linkBtnStyle}>
            Gerir lista
          </button>
        </div>
        <select value={form.school} onChange={set("school")} style={inputStyle}>
          <option value="">Sem escola associada</option>
          {schoolOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <label style={labelStyle}>Reclamação associada (opcional)</label>
        <select value={form.relatedComplaintId} onChange={set("relatedComplaintId")} style={inputStyle}>
          <option value="">Nenhuma — ocorrência independente</option>
          {complaints.map((c) => (
            <option key={c.id} value={c.id}>
              Nº {String(c.entryNumber).padStart(4, "0")} — {c.complainant}
            </option>
          ))}
        </select>

        <label style={labelStyle}>Motivo</label>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {Object.entries(MOTIVO_META).map(([key, meta]) => (
            <button
              key={key}
              onClick={() => setForm((f) => ({ ...f, motivo: key }))}
              style={{
                flex: "1 1 30%",
                padding: "7px 6px",
                borderRadius: 4,
                border: `1.5px solid ${form.motivo === key ? meta.color : COLORS.rule}`,
                background: form.motivo === key ? meta.bg : "transparent",
                color: form.motivo === key ? meta.color : COLORS.ink,
                fontSize: 11.5,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {meta.label}
            </button>
          ))}
        </div>

        <label style={labelStyle}>Data da ocorrência</label>
        <input type="date" value={form.date} onChange={set("date")} style={inputStyle} />

        <label style={labelStyle}>Descrição da ocorrência</label>
        <textarea
          rows={4}
          placeholder="O que aconteceu..."
          value={form.description}
          onChange={set("description")}
          style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
        />

        {form.personType === "familia" && (
          <>
            <label style={labelStyle}>Foi aplicada sanção?</label>
            <div style={{ display: "flex", gap: 8 }}>
              {[
                { key: true, label: "Sim" },
                { key: false, label: "Não" },
              ].map((opt) => (
                <button
                  key={String(opt.key)}
                  onClick={() => setForm((f) => ({ ...f, sanctionApplied: opt.key }))}
                  style={{
                    flex: 1,
                    padding: "8px 6px",
                    borderRadius: 4,
                    border: `1.5px solid ${form.sanctionApplied === opt.key ? COLORS.navy : COLORS.rule}`,
                    background: form.sanctionApplied === opt.key ? COLORS.navy : "transparent",
                    color: form.sanctionApplied === opt.key ? COLORS.onAccent : COLORS.ink,
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {form.sanctionApplied === true && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <label style={{ ...labelStyle }}>Tipo de sanção</label>
                  <button type="button" onClick={() => onGerirLista("sanctionTypes")} style={linkBtnStyle}>
                    Gerir lista
                  </button>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {sanctionTypes.length === 0 && (
                    <div style={{ fontSize: 12, color: COLORS.slate }}>Sem tipos — usa "Gerir lista" para adicionar.</div>
                  )}
                  {sanctionTypes.map((label) => {
                    const meta = colorForLabel(label);
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, sanctionType: label }))}
                        style={{
                          flex: "1 1 45%",
                          padding: "8px 6px",
                          borderRadius: 4,
                          border: `1.5px solid ${form.sanctionType === label ? meta.color : COLORS.rule}`,
                          background: form.sanctionType === label ? meta.bg : "transparent",
                          color: form.sanctionType === label ? meta.color : COLORS.ink,
                          fontSize: 11.5,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                <label style={labelStyle}>Detalhe da sanção (opcional)</label>
                <textarea
                  rows={3}
                  placeholder="Ex: duração, condições, data de reavaliação..."
                  value={form.sanctionDescription}
                  onChange={set("sanctionDescription")}
                  style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
                />
              </>
            )}
          </>
        )}

        {form.personType === "elemento_df" && (
          <div style={{ marginTop: 14, fontSize: 12, color: COLORS.slate, padding: "10px 12px", background: COLORS.paper, borderRadius: 4, border: `1px solid ${COLORS.rule}` }}>
            Como se trata de um elemento Dragon Force, o processo disciplinar (inquérito → proposta de sanção → decisão
            final de suspensão ou expulsão) é gerido depois, a partir do detalhe da ocorrência.
          </div>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
          <button onClick={onCancel} style={secondaryBtnStyle}>
            Cancelar
          </button>
          <button
            onClick={() => {
              if (!form.personName.trim()) return;
              onSave({
                ...form,
                id: `s_${Date.now()}`,
                stage: form.personType === "elemento_df" ? "ocorrencia" : null,
                notes: [],
              });
            }}
            style={primaryBtnStyle}
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Sanções: detalhe / progressão do processo ----------
function SanctionDetail({ sanction, onClose, onUpdate, onAddNote, onRemove, complaints, sanctionTypes }) {
  const [note, setNote] = useState("");
  const [propostaText, setPropostaText] = useState(sanction.propostaSancao || "");
  const [sancaoFamiliaText, setSancaoFamiliaText] = useState(sanction.sanctionDescription || "");
  const notes = [...(sanction.notes || [])].sort((a, b) => new Date(b.date) - new Date(a.date));
  const motivoMeta = MOTIVO_META[sanction.motivo] || MOTIVO_META.outro;
  const relatedComplaint = sanction.relatedComplaintId ? complaints.find((c) => c.id === sanction.relatedComplaintId) : null;

  const submitNote = () => {
    const v = note.trim();
    if (!v) return;
    onAddNote(sanction.id, v);
    setNote("");
  };

  return (
    <div
      className="veil"
      style={{ position: "fixed", inset: 0, background: "rgba(8,14,24,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 55, padding: 16 }}
      onClick={onClose}
    >
      <div
        className="sheet"
        style={{ width: "min(540px, 100%)", maxHeight: "calc(100vh - 32px)", overflowY: "auto", background: COLORS.paperRaised, borderRadius: 14, padding: "22px 22px 24px", border: `1px solid ${COLORS.rule}`, boxShadow: "0 20px 50px -12px rgba(8,14,24,0.35)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
          <div style={{ fontVariantNumeric: "tabular-nums", fontSize: 12, color: COLORS.slate, letterSpacing: "0.08em" }}>
            {fmt(new Date(sanction.date + "T00:00:00"))}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button title="Eliminar" onClick={() => onRemove(sanction.id)} style={iconBtnStyle}>
              <Trash2 size={16} color={COLORS.danger} />
            </button>
            <button onClick={onClose} style={iconBtnStyle}>
              <X size={18} />
            </button>
          </div>
        </div>
        <h2 style={{ margin: "6px 0 6px", fontSize: 20, color: COLORS.navy }}>{sanction.personName}</h2>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
          <Tag label={PERSON_TYPE_META[sanction.personType].label} color={COLORS.navy} bg={COLORS.rule} />
          <Tag label={motivoMeta.label} color={motivoMeta.color} bg={motivoMeta.bg} />
          {sanction.school && <Tag label={sanction.school} color={COLORS.slate} bg={COLORS.doneBg} />}
        </div>

        {relatedComplaint && (
          <div style={{ fontSize: 12.5, color: COLORS.navySoft, marginBottom: 14 }}>
            Associada à reclamação Nº {String(relatedComplaint.entryNumber).padStart(4, "0")} — {relatedComplaint.complainant}
          </div>
        )}

        {sanction.description && (
          <div style={{ fontSize: 13.5, marginBottom: 18, padding: "10px 12px", background: COLORS.paper, borderRadius: 4, border: `1px solid ${COLORS.rule}` }}>
            {sanction.description}
          </div>
        )}

        {sanction.personType === "familia" ? (
          <div style={{ marginBottom: 20 }}>
            <label style={{ ...labelStyle, marginTop: 0 }}>Foi aplicada sanção?</label>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              {[
                { key: true, label: "Sim" },
                { key: false, label: "Não" },
              ].map((opt) => (
                <button
                  key={String(opt.key)}
                  onClick={() => onUpdate(sanction.id, { sanctionApplied: opt.key })}
                  style={{
                    flex: 1,
                    padding: "8px 6px",
                    borderRadius: 4,
                    border: `1.5px solid ${sanction.sanctionApplied === opt.key ? COLORS.navy : COLORS.rule}`,
                    background: sanction.sanctionApplied === opt.key ? COLORS.navy : "transparent",
                    color: sanction.sanctionApplied === opt.key ? COLORS.onAccent : COLORS.ink,
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {sanction.sanctionApplied === true && (
              <>
                <label style={{ ...labelStyle, marginTop: 4 }}>Tipo de sanção</label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                  {(sanctionTypes || []).map((label) => {
                    const meta = colorForLabel(label);
                    const active = sanction.sanctionType === label;
                    return (
                      <button
                        key={label}
                        onClick={() => onUpdate(sanction.id, { sanctionType: label })}
                        style={{
                          flex: "1 1 45%",
                          padding: "8px 6px",
                          borderRadius: 4,
                          border: `1.5px solid ${active ? meta.color : COLORS.rule}`,
                          background: active ? meta.bg : "transparent",
                          color: active ? meta.color : COLORS.ink,
                          fontSize: 11.5,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <textarea
                    rows={2}
                    placeholder="Detalhe da sanção (duração, condições)..."
                    value={sancaoFamiliaText}
                    onChange={(e) => setSancaoFamiliaText(e.target.value)}
                    style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit", flex: 1 }}
                  />
                  <button
                    onClick={() => onUpdate(sanction.id, { sanctionDescription: sancaoFamiliaText })}
                    style={{ ...primaryBtnStyle, flex: "none", padding: "0 14px" }}
                  >
                    Guardar
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: COLORS.slate, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
              Processo disciplinar
            </div>
            <Tag label={DF_STAGE_META[sanction.stage]?.label || "Ocorrência registada"} color={DF_STAGE_META[sanction.stage]?.color || COLORS.slate} bg={DF_STAGE_META[sanction.stage]?.bg || COLORS.doneBg} />

            {sanction.stage === "ocorrencia" && (
              <button
                onClick={() => onUpdate(sanction.id, { stage: "inquerito", inqueritoDate: new Date().toISOString() })}
                style={{ ...secondaryBtnStyle, flex: "none", padding: "8px 14px", marginTop: 12, display: "block" }}
              >
                Abrir inquérito disciplinar
              </button>
            )}

            {sanction.stage === "inquerito" && (
              <div style={{ marginTop: 12 }}>
                <label style={{ ...labelStyle, marginTop: 0 }}>Proposta de sanção (para tomada de decisão)</label>
                <textarea
                  rows={3}
                  placeholder="Conclusões do inquérito e proposta de sanção..."
                  value={propostaText}
                  onChange={(e) => setPropostaText(e.target.value)}
                  style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
                />
                <button
                  onClick={() => onUpdate(sanction.id, { stage: "proposta", propostaSancao: propostaText })}
                  style={{ ...secondaryBtnStyle, flex: "none", padding: "8px 14px" }}
                >
                  Submeter proposta para decisão
                </button>
              </div>
            )}

            {(sanction.stage === "proposta" || sanction.stage === "decisao_suspensao" || sanction.stage === "decisao_expulsao" || sanction.stage === "decisao_arquivado") && sanction.propostaSancao && (
              <div style={{ fontSize: 13, marginTop: 12, padding: "10px 12px", background: COLORS.paper, borderRadius: 4, border: `1px solid ${COLORS.rule}` }}>
                <strong>Proposta:</strong> {sanction.propostaSancao}
              </div>
            )}

            {sanction.stage === "proposta" && (
              <div style={{ marginTop: 14 }}>
                <label style={{ ...labelStyle, marginTop: 0 }}>Decisão final</label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button
                    onClick={() => onUpdate(sanction.id, { stage: "decisao_suspensao", decisaoDate: new Date().toISOString() })}
                    style={{ ...secondaryBtnStyle, flex: "1 1 30%", padding: "8px 6px", fontSize: 12, borderColor: COLORS.danger, color: COLORS.danger }}
                  >
                    Suspensão
                  </button>
                  <button
                    onClick={() => onUpdate(sanction.id, { stage: "decisao_expulsao", decisaoDate: new Date().toISOString() })}
                    style={{ ...secondaryBtnStyle, flex: "1 1 30%", padding: "8px 6px", fontSize: 12, borderColor: COLORS.danger, color: COLORS.danger }}
                  >
                    Expulsão do projeto
                  </button>
                  <button
                    onClick={() => onUpdate(sanction.id, { stage: "decisao_arquivado", decisaoDate: new Date().toISOString() })}
                    style={{ ...secondaryBtnStyle, flex: "1 1 30%", padding: "8px 6px", fontSize: 12, borderColor: COLORS.ok, color: COLORS.ok }}
                  >
                    Arquivar / sem sanção
                  </button>
                </div>
              </div>
            )}

            {sanction.decisaoDate && (
              <div style={{ fontSize: 12, color: COLORS.slate, marginTop: 10, fontVariantNumeric: "tabular-nums" }}>
                Decisão registada em {fmt(new Date(sanction.decisaoDate))}
              </div>
            )}
          </div>
        )}

        <div style={{ fontSize: 11.5, fontWeight: 600, color: COLORS.slate, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
          Notas
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <textarea
            rows={2}
            placeholder="Adicionar nota ao processo..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit", flex: 1 }}
          />
          <button onClick={submitNote} style={{ ...primaryBtnStyle, flex: "none", padding: "0 16px" }}>
            Adicionar
          </button>
        </div>
        {notes.length === 0 ? (
          <div style={{ fontSize: 13, color: COLORS.slate }}>Ainda sem notas.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {notes.map((n) => (
              <div key={n.id} style={{ borderLeft: `2.5px solid ${COLORS.navySoft}`, paddingLeft: 12 }}>
                <div style={{ fontSize: 11, fontVariantNumeric: "tabular-nums", color: COLORS.slate, marginBottom: 3 }}>
                  {new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(
                    new Date(n.date)
                  )}
                </div>
                <div style={{ fontSize: 13.5 }}>{n.text}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Sanções: página (lista + análise) ----------
function SanctionsPage({ sanctions, onNew, onOpen }) {
  const familia = sanctions.filter((s) => s.personType === "familia");
  const elementosDF = sanctions.filter((s) => s.personType === "elemento_df");

  const sancoesAplicadasFamilia = familia.filter((s) => s.sanctionApplied === true).length;
  const semSancaoFamilia = familia.filter((s) => s.sanctionApplied === false).length;
  const sancoesFinaisDF = elementosDF.filter((s) => s.stage === "decisao_suspensao" || s.stage === "decisao_expulsao").length;
  const semSancaoDF = elementosDF.filter((s) => s.stage === "decisao_arquivado").length;

  const motivoData = Object.entries(MOTIVO_META).map(([key, meta]) => ({
    name: meta.label,
    value: sanctions.filter((s) => s.motivo === key).length,
    color: meta.color,
  }));

  const tipoSancaoData = useMemo(() => {
    const counts = {};
    familia.forEach((s) => {
      if (s.sanctionApplied === true && s.sanctionType) counts[s.sanctionType] = (counts[s.sanctionType] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value, color: colorForLabel(name).color }));
  }, [familia]);

  const Row = ({ s }) => (
    <div
      key={s.id}
      onClick={() => onOpen(s)}
      style={{
        ...panelStyle,
        padding: "12px 16px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        cursor: "pointer",
        flexWrap: "wrap",
        gap: 10,
      }}
    >
      <div>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{s.personName}</div>
        <div style={{ fontSize: 12, color: COLORS.slate, fontVariantNumeric: "tabular-nums" }}>
          {fmt(new Date(s.date + "T00:00:00"))}
          {s.school ? ` · ${s.school}` : ""}
          {s.relatedComplaintId ? " · associada a reclamação" : ""}
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <Tag label={MOTIVO_META[s.motivo].label} color={MOTIVO_META[s.motivo].color} bg={MOTIVO_META[s.motivo].bg} />
        {s.personType === "familia" ? (
          s.sanctionApplied === true ? (
            <Tag label={s.sanctionType || "Sanção aplicada"} color={COLORS.danger} bg={COLORS.dangerBg} />
          ) : s.sanctionApplied === false ? (
            <Tag label="Sem sanção" color={COLORS.ok} bg={COLORS.okBg} />
          ) : (
            <Tag label="Por decidir" color={COLORS.slate} bg={COLORS.doneBg} />
          )
        ) : (
          <Tag
            label={DF_STAGE_META[s.stage]?.label || "Ocorrência registada"}
            color={DF_STAGE_META[s.stage]?.color || COLORS.slate}
            bg={DF_STAGE_META[s.stage]?.bg || COLORS.doneBg}
          />
        )}
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", flex: 1 }}>
          <StatCard label="Total de ocorrências" value={sanctions.length} />
          <StatCard label="Sanções aplicadas (Pais/EE)" value={sancoesAplicadasFamilia} color={COLORS.danger} />
          <StatCard label="Sem sanção (Pais/EE)" value={semSancaoFamilia} color={COLORS.ok} />
          <StatCard label="Suspensão/Expulsão (DF)" value={sancoesFinaisDF} color={COLORS.danger} />
        </div>
        <button
          onClick={onNew}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: COLORS.navy,
            color: COLORS.onAccent,
            border: "none",
            borderRadius: 4,
            padding: "10px 16px",
            fontWeight: 700,
            fontSize: 14,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          <Plus size={16} /> Nova ocorrência
        </button>
      </div>

      {sanctions.length > 0 && (
        <div style={{ ...panelStyle, marginBottom: 24 }}>
          <div style={panelTitle}>Ocorrências por motivo (má conduta, ameaças, insultos, agressões)</div>
          <ResponsiveContainer width="100%" height={Math.max(160, motivoData.length * 34)}>
            <BarChart data={motivoData} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid stroke={COLORS.ruleSoft} strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: COLORS.slate }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12, fill: COLORS.ink }} axisLine={false} tickLine={false} />
              <Tooltip content={<DicaGrafico />} cursor={{ fill: COLORS.ruleSoft }} />
              <Bar dataKey="value" fill={COLORS.navySoft} radius={[0, 3, 3, 0]} barSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {tipoSancaoData.length > 0 && (
        <div style={{ ...panelStyle, marginBottom: 24 }}>
          <div style={panelTitle}>Sanções aplicadas por tipo (Pais / EE)</div>
          <ResponsiveContainer width="100%" height={Math.max(160, tipoSancaoData.length * 34)}>
            <BarChart data={tipoSancaoData} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid stroke={COLORS.ruleSoft} strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: COLORS.slate }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 12, fill: COLORS.ink }} axisLine={false} tickLine={false} />
              <Tooltip content={<DicaGrafico />} cursor={{ fill: COLORS.ruleSoft }} />
              <Bar dataKey="value" fill={COLORS.danger} radius={[0, 3, 3, 0]} barSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div style={panelTitle}>Sanções a Pais / Encarregados de Educação</div>
      {familia.length === 0 ? (
        <div style={{ marginBottom: 26 }}>
          <Vazio icon={Scale} titulo="Sem ocorrências com pais ou encarregados" texto="As que registares aparecem aqui, com o motivo e a sanção aplicada." />
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 26 }}>
          {[...familia].sort((a, b) => new Date(b.date) - new Date(a.date)).map((s) => <Row key={s.id} s={s} />)}
        </div>
      )}

      <div style={panelTitle}>Elementos Dragon Force (processo disciplinar)</div>
      {elementosDF.length === 0 ? (
        <Vazio icon={ShieldAlert} titulo="Sem ocorrências com elementos Dragon Force" texto="Aqui acompanhas o processo disciplinar: inquérito, proposta e decisão." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[...elementosDF].sort((a, b) => new Date(b.date) - new Date(a.date)).map((s) => <Row key={s.id} s={s} />)}
        </div>
      )}
    </div>
  );
}

// ---------- Componentes partilhados das secções de gestão ----------

// Barra de lotação reutilizada nas turmas e no mapa de espaços.
function BarraLotacao({ pct, largura }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ height: 7, width: largura || 80, background: COLORS.doneBg, borderRadius: 4, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${Math.min(pct, 100)}%`, background: corLotacao(pct) }} />
      </div>
      <span style={{ fontVariantNumeric: "tabular-nums", fontSize: 12, color: COLORS.slate }}>{pct}%</span>
    </div>
  );
}

const thStyle = {
  textAlign: "left",
  fontSize: 10.5,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: COLORS.slate,
  padding: "9px 10px",
  borderBottom: `1px solid ${COLORS.rule}`,
  whiteSpace: "nowrap",
};
const tdStyle = { padding: "9px 10px", borderBottom: "1px solid #EFEDE7", fontSize: 13.5 };

function Filtros({ children }) {
  return <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>{children}</div>;
}

function SemDados({ texto, icon, titulo, acao, onAcao }) {
  return <Vazio icon={icon || Inbox} titulo={titulo || "Sem dados para mostrar"} texto={texto} acao={acao} onAcao={onAcao} />;
}

// ---------- Desistências ----------
function SecaoDesistencias({ escolas, turmas, niveis, motivos, desistencias, onSave, onRemove, onGerirLista }) {
  const [escola, setEscola] = useState(escolas[0] || "");
  const [turma, setTurma] = useState("");
  const [motivo, setMotivo] = useState(motivos[0] || "");
  const [n, setN] = useState("1");
  const [erro, setErro] = useState("");

  const [fEsc, setFEsc] = useState("todas");
  const [fEsca, setFEsca] = useState("todos");
  const [fMot, setFMot] = useState("todos");

  const turmasEscola = [...new Set(turmas.filter((t) => t.escola === escola).map((t) => t.turma))];
  const escaloes = [...new Set(desistencias.map((d) => escalaoDaTurma(d.turma, niveis)))].sort();

  const lista = desistencias
    .filter((d) => (fEsc === "todas" ? true : d.escola === fEsc))
    .filter((d) => (fEsca === "todos" ? true : escalaoDaTurma(d.turma, niveis) === fEsca))
    .filter((d) => (fMot === "todos" ? true : d.motivo === fMot))
    .sort((a, b) => String(b.data).localeCompare(String(a.data)));

  const total = lista.reduce((s, d) => s + d.n, 0);
  const porMotivo = motivos
    .map((m) => ({ m, n: lista.filter((d) => d.motivo === m).reduce((s, d) => s + d.n, 0) }))
    .filter((x) => x.n)
    .sort((a, b) => b.n - a.n);

  const guardar = () => {
    if (!turma) {
      setErro("Escolhe a turma.");
      return;
    }
    if (n === "" || Number(n) < 1) {
      setErro("Indica quantas desistências.");
      return;
    }
    setErro("");
    onSave({ id: `d_${Date.now()}`, escola, turma, motivo, n: Math.round(Number(n)), data: new Date().toISOString().slice(0, 10) });
    setN("1");
  };

  return (
    <div>
      <div style={{ ...panelStyle, marginBottom: 16 }}>
        <div style={panelTitle}>Registar desistências</div>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div>
            <label style={{ ...labelStyle, marginTop: 0 }}>Escola</label>
            <select value={escola} onChange={(e) => { setEscola(e.target.value); setTurma(""); }} style={{ ...inputStyle, width: 170 }}>
              {escolas.map((e) => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ ...labelStyle, marginTop: 0 }}>Turma / equipa</label>
            <select value={turma} onChange={(e) => setTurma(e.target.value)} style={{ ...inputStyle, width: 165 }}>
              <option value="">{turmasEscola.length ? "Selecionar..." : "Sem turmas nesta escola"}</option>
              {turmasEscola.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
              <label style={{ ...labelStyle, marginTop: 0 }}>Motivo</label>
              <button type="button" onClick={() => onGerirLista("motivosDesistencia")} style={{ ...linkBtnStyle, marginTop: 0 }}>Gerir</button>
            </div>
            <select value={motivo} onChange={(e) => setMotivo(e.target.value)} style={{ ...inputStyle, width: 230 }}>
              {motivos.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ ...labelStyle, marginTop: 0 }}>Quantos</label>
            <input type="number" min="1" value={n} onChange={(e) => { setN(e.target.value); setErro(""); }} style={{ ...inputStyle, width: 95 }} />
          </div>
          <button onClick={guardar} style={{ ...primaryBtnStyle, flex: "none", padding: "9px 16px" }}>Registar</button>
        </div>
        {erro && <div style={{ color: COLORS.danger, fontSize: 13, marginTop: 8 }}>{erro}</div>}
        <div style={{ fontSize: 11.5, color: COLORS.slate, marginTop: 9 }}>
          Registam-se contagens e motivos — sem nomes nem identificação de atletas.
        </div>
      </div>

      <Filtros>
        <select value={fEsc} onChange={(e) => setFEsc(e.target.value)} style={{ ...inputStyle, width: 180 }}>
          <option value="todas">Todas as escolas</option>
          {escolas.map((e) => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>
        <select value={fEsca} onChange={(e) => setFEsca(e.target.value)} style={{ ...inputStyle, width: 180 }}>
          <option value="todos">Todos os escalões</option>
          {escaloes.map((x) => (
            <option key={x} value={x}>{x}</option>
          ))}
        </select>
        <select value={fMot} onChange={(e) => setFMot(e.target.value)} style={{ ...inputStyle, width: 230 }}>
          <option value="todos">Todos os motivos</option>
          {motivos.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </Filtros>

      <div style={{ display: "flex", gap: 14, marginBottom: 16, flexWrap: "wrap" }}>
        <StatCard label="Desistências" value={total} color={COLORS.danger} subtitle="nos filtros escolhidos" />
        <StatCard label="Registos" value={lista.length} />
        <StatCard label="Motivo mais frequente" value={porMotivo.length ? porMotivo[0].n : "—"} subtitle={porMotivo.length ? porMotivo[0].m : ""} />
      </div>

      {lista.length === 0 ? (
        <SemDados texto="Sem desistências para os filtros selecionados." />
      ) : (
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <div style={{ ...panelStyle, flex: "1 1 300px" }}>
            <div style={panelTitle}>Por motivo</div>
            {porMotivo.map((x) => (
              <div key={x.m} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <div style={{ flex: 1, fontSize: 13 }}>{x.m}</div>
                <div style={{ height: 7, width: 110, background: COLORS.doneBg, borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${(x.n / porMotivo[0].n) * 100}%`, background: COLORS.danger }} />
                </div>
                <div style={{ fontVariantNumeric: "tabular-nums", fontSize: 12, width: 24, textAlign: "right" }}>{x.n}</div>
              </div>
            ))}
          </div>
          <div style={{ ...panelStyle, flex: "1 1 380px" }}>
            <div style={panelTitle}>Registos ({lista.length})</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Data", "Escola", "Turma", "Escalão", "Motivo", "Nº", ""].map((h) => (
                      <th key={h} style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lista.map((d) => (
                    <tr key={d.id}>
                      <td style={{ ...tdStyle, fontVariantNumeric: "tabular-nums", fontSize: 12 }}>{d.data}</td>
                      <td style={tdStyle}>{d.escola}</td>
                      <td style={tdStyle}>{d.turma}</td>
                      <td style={tdStyle}>{escalaoDaTurma(d.turma, niveis)}</td>
                      <td style={{ ...tdStyle, fontSize: 12.5 }}>{d.motivo}</td>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{d.n}</td>
                      <td style={tdStyle}>
                        <button title="Remover" onClick={() => onRemove(d.id)} style={{ ...iconBtnStyle, padding: 0 }}>
                          <X size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Experiências ----------
function SecaoExperiencias({ escolas, turmas, niveis, experiencias, onSave, onUpdate, onRemove }) {
  const [aviso, setAviso] = useState("");
  const avaliar = (id, resultado) => setAviso(onUpdate(id, resultado) || "");
  const [escola, setEscola] = useState(escolas[0] || "");
  const [turma, setTurma] = useState("");
  const [n, setN] = useState("1");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [erro, setErro] = useState("");

  const [fEsc, setFEsc] = useState("todas");
  const [fRes, setFRes] = useState("todos");
  const [fMes, setFMes] = useState("todos");

  const turmasEscola = [...new Set(turmas.filter((t) => t.escola === escola).map((t) => t.turma))];
  const meses = [...new Set(experiencias.map((x) => mesDeData(x.data)).filter(Boolean))].sort().reverse();

  const lista = experiencias
    .filter((x) => (fEsc === "todas" ? true : x.escola === fEsc))
    .filter((x) => (fRes === "todos" ? true : x.resultado === fRes))
    .filter((x) => (fMes === "todos" ? true : mesDeData(x.data) === fMes))
    .sort((a, b) => String(b.data).localeCompare(String(a.data)));

  const soma = (arr) => arr.reduce((s, x) => s + x.n, 0);
  const realizadas = soma(lista);
  const sucesso = soma(lista.filter((x) => x.resultado === "sucesso"));
  const fechadas = soma(lista.filter((x) => x.resultado !== "pendente"));
  const pendentes = soma(lista.filter((x) => x.resultado === "pendente"));
  const fidelizacao = fechadas ? Math.round((sucesso / fechadas) * 100) : null;

  // Evolução mensal da conversão, para se ver a tendência.
  const porMes = [...new Set(experiencias.map((x) => mesDeData(x.data)).filter(Boolean))].sort().map((m) => {
    const doMes = experiencias.filter((x) => mesDeData(x.data) === m && (fEsc === "todas" || x.escola === fEsc));
    const f = soma(doMes.filter((x) => x.resultado !== "pendente"));
    const s = soma(doMes.filter((x) => x.resultado === "sucesso"));
    return { name: m, realizadas: soma(doMes), convertidas: s, taxa: f ? Math.round((s / f) * 100) : 0 };
  });

  const guardar = () => {
    if (!turma) {
      setErro("Escolhe a turma.");
      return;
    }
    if (n === "" || Number(n) < 1) {
      setErro("Indica pelo menos 1 atleta.");
      return;
    }
    setErro("");
    onSave({ id: `x_${Date.now()}`, escola, turma, n: Math.round(Number(n)), resultado: "pendente", data });
    setN("1");
  };

  return (
    <div>
      <div style={{ ...panelStyle, marginBottom: 16 }}>
        <div style={panelTitle}>Registar experiência</div>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div>
            <label style={{ ...labelStyle, marginTop: 0 }}>Escola</label>
            <select value={escola} onChange={(e) => { setEscola(e.target.value); setTurma(""); }} style={{ ...inputStyle, width: 170 }}>
              {escolas.map((e) => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ ...labelStyle, marginTop: 0 }}>Turma / equipa</label>
            <select value={turma} onChange={(e) => setTurma(e.target.value)} style={{ ...inputStyle, width: 165 }}>
              <option value="">{turmasEscola.length ? "Selecionar..." : "Sem turmas nesta escola"}</option>
              {turmasEscola.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ ...labelStyle, marginTop: 0 }}>Nº de atletas</label>
            <input type="number" min="1" value={n} onChange={(e) => { setN(e.target.value); setErro(""); }} style={{ ...inputStyle, width: 110 }} />
          </div>
          <div>
            <label style={{ ...labelStyle, marginTop: 0 }}>Data</label>
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} style={{ ...inputStyle, width: 160 }} />
          </div>
          <button onClick={guardar} style={{ ...primaryBtnStyle, flex: "none", padding: "9px 16px" }}>Registar</button>
        </div>
        {erro && <div style={{ color: COLORS.danger, fontSize: 13, marginTop: 8 }}>{erro}</div>}
        <div style={{ fontSize: 11.5, color: COLORS.slate, marginTop: 9 }}>
          Ao marcar como convertida, os atletas entram na turma e passam a contar nos inscritos.
        </div>
      </div>

      <Filtros>
        <select value={fEsc} onChange={(e) => setFEsc(e.target.value)} style={{ ...inputStyle, width: 180 }}>
          <option value="todas">Todas as escolas</option>
          {escolas.map((e) => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>
        <select value={fRes} onChange={(e) => setFRes(e.target.value)} style={{ ...inputStyle, width: 180 }}>
          <option value="todos">Todos os resultados</option>
          {Object.entries(XP_RESULTADO_META).map(([k, m]) => (
            <option key={k} value={k}>{m.label}</option>
          ))}
        </select>
        <select value={fMes} onChange={(e) => setFMes(e.target.value)} style={{ ...inputStyle, width: 160 }}>
          <option value="todos">Todos os meses</option>
          {meses.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </Filtros>

      <div style={{ display: "flex", gap: 14, marginBottom: 16, flexWrap: "wrap" }}>
        <StatCard label="Experiências" value={realizadas} />
        <StatCard label="Convertidas" value={sucesso} color={COLORS.ok} />
        <StatCard label="Por avaliar" value={pendentes} color={COLORS.warn} />
        <StatCard
          label="Taxa de fidelização"
          value={fidelizacao === null ? "—" : `${fidelizacao}%`}
          color={COLORS.ok}
          subtitle={`${sucesso} de ${fechadas} avaliadas`}
          anel={fidelizacao}
        />
      </div>

      {aviso && (
        <div
          style={{
            background: COLORS.warnBg,
            border: `1px solid ${COLORS.warn}`,
            color: COLORS.warn,
            borderRadius: 5,
            padding: "10px 13px",
            fontSize: 13,
            marginBottom: 16,
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <span>{aviso}</span>
          <button onClick={() => setAviso("")} style={{ ...iconBtnStyle, padding: 0 }}>
            <X size={14} />
          </button>
        </div>
      )}

      {porMes.length > 1 && (
        <div style={{ ...panelStyle, marginBottom: 16 }}>
          <div style={panelTitle}>Experiências e conversão por mês</div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={porMes}>
              <CartesianGrid stroke={COLORS.ruleSoft} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: COLORS.slate }} axisLine={{ stroke: COLORS.rule }} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: COLORS.slate }} axisLine={false} tickLine={false} width={30} />
              <Tooltip content={<DicaGrafico />} cursor={{ fill: COLORS.ruleSoft }} />
              <Bar dataKey="realizadas" name="Realizadas" fill={COLORS.slate} radius={[3, 3, 0, 0]} animationDuration={800} />
              <Bar dataKey="convertidas" name="Convertidas" fill={COLORS.ok} radius={[3, 3, 0, 0]} animationDuration={800} />
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", justifyContent: "center", gap: 14, fontSize: 11.5, marginTop: 6 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 9, height: 9, borderRadius: 2, background: COLORS.slate }} /> Realizadas
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 9, height: 9, borderRadius: 2, background: COLORS.ok }} /> Convertidas
            </span>
          </div>
        </div>
      )}

      {lista.length === 0 ? (
        <SemDados texto="Sem experiências para os filtros selecionados." />
      ) : (
        <div style={panelStyle}>
          <div style={panelTitle}>Registos ({lista.length})</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Data", "Escola", "Turma", "Atletas", "Resultado", "Avaliar", ""].map((h) => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lista.map((x) => {
                  const meta = XP_RESULTADO_META[x.resultado] || XP_RESULTADO_META.pendente;
                  return (
                    <tr key={x.id}>
                      <td style={{ ...tdStyle, fontVariantNumeric: "tabular-nums", fontSize: 12 }}>{x.data}</td>
                      <td style={tdStyle}>{x.escola}</td>
                      <td style={tdStyle}>{x.turma}</td>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{x.n}</td>
                      <td style={tdStyle}>
                        <Tag label={meta.label} color={meta.color} bg={meta.bg} />
                      </td>
                      <td style={tdStyle}>
                        {x.resultado === "pendente" ? (
                          <div style={{ display: "flex", gap: 6 }}>
                            <button
                              onClick={() => avaliar(x.id, "sucesso")}
                              style={{ ...secondaryBtnStyle, flex: "none", padding: "5px 11px", fontSize: 12, borderColor: COLORS.ok, color: COLORS.ok }}
                            >
                              Converteu
                            </button>
                            <button
                              onClick={() => avaliar(x.id, "insucesso")}
                              style={{ ...secondaryBtnStyle, flex: "none", padding: "5px 11px", fontSize: 12, borderColor: COLORS.danger, color: COLORS.danger }}
                            >
                              Não
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => avaliar(x.id, "pendente")} style={{ ...secondaryBtnStyle, flex: "none", padding: "5px 11px", fontSize: 12 }}>
                            Reverter
                          </button>
                        )}
                      </td>
                      <td style={tdStyle}>
                        <button title="Remover" onClick={() => onRemove(x.id)} style={{ ...iconBtnStyle, padding: 0 }}>
                          <X size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Desvinculações ----------
function SecaoDesvinculacoes({ escolas, desvinculacoes, onSave, onUpdate, onRemove }) {
  const [escola, setEscola] = useState(escolas[0] || "");
  const [quem, setQuem] = useState(QUEM_PEDIU[0]);
  const [clube, setClube] = useState("");
  const [decisao, setDecisao] = useState("");
  const [cedida, setCedida] = useState("0");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));

  const [fEsc, setFEsc] = useState("todas");
  const [fQuem, setFQuem] = useState("todos");
  const [fClube, setFClube] = useState("todos");
  const [fCed, setFCed] = useState("todos");

  const clubes = [...new Set(desvinculacoes.map((v) => v.clubeDestino).filter(Boolean))].sort();

  const lista = desvinculacoes
    .filter((v) => (fEsc === "todas" ? true : v.escola === fEsc))
    .filter((v) => (fQuem === "todos" ? true : v.quemPediu === fQuem))
    .filter((v) => (fClube === "todos" ? true : v.clubeDestino === fClube))
    .filter((v) => (fCed === "todos" ? true : fCed === "sim" ? v.cedida === true : v.cedida !== true))
    .sort((a, b) => String(b.data).localeCompare(String(a.data)));

  const aceites = lista.filter((v) => v.aceite === true).length;
  const recusados = lista.filter((v) => v.aceite === false).length;
  const cedidos = lista.filter((v) => v.cedida === true).length;

  const guardar = () => {
    onSave({
      id: `v_${Date.now()}`,
      escola,
      quemPediu: quem,
      clubeDestino: clube.trim(),
      aceite: decisao === "" ? null : decisao === "1",
      cedida: cedida === "1",
      data,
    });
    setClube("");
    setDecisao("");
    setCedida("0");
  };

  return (
    <div>
      <div style={{ ...panelStyle, marginBottom: 16 }}>
        <div style={panelTitle}>Registar pedido de desvinculação</div>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div>
            <label style={{ ...labelStyle, marginTop: 0 }}>Escola</label>
            <select value={escola} onChange={(e) => setEscola(e.target.value)} style={{ ...inputStyle, width: 165 }}>
              {escolas.map((e) => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ ...labelStyle, marginTop: 0 }}>Pedido por</label>
            <select value={quem} onChange={(e) => setQuem(e.target.value)} style={{ ...inputStyle, width: 195 }}>
              {QUEM_PEDIU.map((q) => (
                <option key={q} value={q}>{q}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ ...labelStyle, marginTop: 0 }}>Clube de destino</label>
            <input
              type="text"
              value={clube}
              onChange={(e) => setClube(e.target.value)}
              placeholder="Nome do clube"
              list="lista-clubes"
              style={{ ...inputStyle, width: 190 }}
            />
            <datalist id="lista-clubes">
              {clubes.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div>
            <label style={{ ...labelStyle, marginTop: 0 }}>Decisão</label>
            <select value={decisao} onChange={(e) => setDecisao(e.target.value)} style={{ ...inputStyle, width: 140 }}>
              <option value="">Pendente</option>
              <option value="1">Aceite</option>
              <option value="0">Recusado</option>
            </select>
          </div>
          <div>
            <label style={{ ...labelStyle, marginTop: 0 }}>Passe cedido</label>
            <select value={cedida} onChange={(e) => setCedida(e.target.value)} style={{ ...inputStyle, width: 110 }}>
              <option value="0">Não</option>
              <option value="1">Sim</option>
            </select>
          </div>
          <div>
            <label style={{ ...labelStyle, marginTop: 0 }}>Data</label>
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} style={{ ...inputStyle, width: 155 }} />
          </div>
          <button onClick={guardar} style={{ ...primaryBtnStyle, flex: "none", padding: "9px 16px" }}>Registar</button>
        </div>
        <div style={{ fontSize: 11.5, color: COLORS.slate, marginTop: 9 }}>
          Sem identificação do atleta — apenas o pedido, o destino, a decisão e se houve cedência.
        </div>
      </div>

      <Filtros>
        <select value={fEsc} onChange={(e) => setFEsc(e.target.value)} style={{ ...inputStyle, width: 170 }}>
          <option value="todas">Todas as escolas</option>
          {escolas.map((e) => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>
        <select value={fQuem} onChange={(e) => setFQuem(e.target.value)} style={{ ...inputStyle, width: 195 }}>
          <option value="todos">Pedido por (todos)</option>
          {QUEM_PEDIU.map((q) => (
            <option key={q} value={q}>{q}</option>
          ))}
        </select>
        <select value={fClube} onChange={(e) => setFClube(e.target.value)} style={{ ...inputStyle, width: 190 }}>
          <option value="todos">Todos os clubes de destino</option>
          {clubes.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select value={fCed} onChange={(e) => setFCed(e.target.value)} style={{ ...inputStyle, width: 160 }}>
          <option value="todos">Cedido ou não</option>
          <option value="sim">Apenas cedidos</option>
          <option value="nao">Apenas não cedidos</option>
        </select>
      </Filtros>

      <div style={{ display: "flex", gap: 14, marginBottom: 16, flexWrap: "wrap" }}>
        <StatCard label="Pedidos" value={lista.length} />
        <StatCard label="Aceites" value={aceites} color={COLORS.ok} subtitle={lista.length ? `${Math.round((aceites / lista.length) * 100)}% dos pedidos` : ""} />
        <StatCard label="Recusados" value={recusados} color={COLORS.danger} />
        <StatCard label="Passes cedidos" value={cedidos} color={COLORS.progress} />
      </div>

      {lista.length === 0 ? (
        <SemDados texto="Sem pedidos para os filtros selecionados." />
      ) : (
        <div style={panelStyle}>
          <div style={panelTitle}>Pedidos ({lista.length})</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Data", "Escola", "Pedido por", "Clube de destino", "Decisão", "Passe cedido", ""].map((h) => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lista.map((v) => (
                  <tr key={v.id}>
                    <td style={{ ...tdStyle, fontVariantNumeric: "tabular-nums", fontSize: 12 }}>{v.data}</td>
                    <td style={tdStyle}>{v.escola}</td>
                    <td style={{ ...tdStyle, fontSize: 12.5 }}>{v.quemPediu}</td>
                    <td style={tdStyle}>{v.clubeDestino || "—"}</td>
                    <td style={tdStyle}>
                      <button
                        onClick={() => onUpdate(v.id, { aceite: v.aceite === null ? true : v.aceite ? false : null })}
                        title="Clica para alternar"
                        style={{
                          border: "none",
                          cursor: "pointer",
                          borderRadius: 3,
                          padding: "3px 9px",
                          fontSize: 11,
                          fontWeight: 600,
                          background: v.aceite === null ? COLORS.doneBg : v.aceite ? COLORS.okBg : COLORS.dangerBg,
                          color: v.aceite === null ? COLORS.slate : v.aceite ? COLORS.ok : COLORS.danger,
                        }}
                      >
                        {v.aceite === null ? "Pendente" : v.aceite ? "Aceite" : "Recusado"}
                      </button>
                    </td>
                    <td style={tdStyle}>
                      <button
                        onClick={() => onUpdate(v.id, { cedida: !v.cedida })}
                        title="Clica para alternar"
                        style={{
                          border: "none",
                          cursor: "pointer",
                          borderRadius: 3,
                          padding: "3px 9px",
                          fontSize: 11,
                          fontWeight: 600,
                          background: v.cedida ? COLORS.progressBg : COLORS.doneBg,
                          color: v.cedida ? COLORS.progress : COLORS.slate,
                        }}
                      >
                        {v.cedida ? "Sim" : "Não"}
                      </button>
                    </td>
                    <td style={tdStyle}>
                      <button title="Remover" onClick={() => onRemove(v.id)} style={{ ...iconBtnStyle, padding: 0 }}>
                        <X size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Espaços: mapa de ocupação com lotação automática ----------
function SecaoEspacos({ escolas, turmas, niveis, espacos, listaEspacos, onSave, onRemove, onGerirLista }) {
  const [escola, setEscola] = useState(escolas[0] || "");
  const [espaco, setEspaco] = useState(listaEspacos[0] || "");
  const [dia, setDia] = useState(DIAS_SEMANA[0]);
  const [hora, setHora] = useState("18:00");
  const [turma, setTurma] = useState("");
  const [erro, setErro] = useState("");

  const turmasEscola = turmas.filter((t) => t.escola === escola);
  const doEscola = espacos.filter((s) => s.escola === escola);
  const usados = [...new Set(doEscola.map((s) => s.espaco))];
  const mostrar = usados.length ? usados : listaEspacos.slice(0, 3);

  // Para cada bloco do mapa, mostra a lotação real da turma que lá treina.
  const infoTurma = (nome) => {
    const t = turmasEscola.find((x) => x.turma === nome);
    if (!t) return null;
    const total = t.m + t.f;
    const cap = t.cap || capacidadeSugerida(nome, niveis);
    return { total, cap, pct: cap ? Math.round((total / cap) * 100) : 0 };
  };

  const guardar = () => {
    if (!turma) {
      setErro("Esta escola não tem turmas registadas.");
      return;
    }
    if (espacos.some((s) => s.escola === escola && s.espaco === espaco && s.dia === dia && s.hora === hora)) {
      setErro(`${espaco} já está ocupado ${dia} às ${hora}.`);
      return;
    }
    setErro("");
    onSave({ id: `s_${Date.now()}`, escola, espaco, dia, hora, turma });
  };

  return (
    <div>
      <div style={{ ...panelStyle, marginBottom: 16 }}>
        <div style={panelTitle}>Atribuir espaço</div>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div>
            <label style={{ ...labelStyle, marginTop: 0 }}>Escola</label>
            <select value={escola} onChange={(e) => { setEscola(e.target.value); setTurma(""); }} style={{ ...inputStyle, width: 165 }}>
              {escolas.map((e) => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          </div>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
              <label style={{ ...labelStyle, marginTop: 0 }}>Espaço</label>
              <button type="button" onClick={() => onGerirLista("espacosLista")} style={{ ...linkBtnStyle, marginTop: 0 }}>Gerir</button>
            </div>
            <select value={espaco} onChange={(e) => setEspaco(e.target.value)} style={{ ...inputStyle, width: 160 }}>
              {listaEspacos.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ ...labelStyle, marginTop: 0 }}>Dia</label>
            <select value={dia} onChange={(e) => setDia(e.target.value)} style={{ ...inputStyle, width: 130 }}>
              {DIAS_SEMANA.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ ...labelStyle, marginTop: 0 }}>Hora</label>
            <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} style={{ ...inputStyle, width: 120 }} />
          </div>
          <div>
            <label style={{ ...labelStyle, marginTop: 0 }}>Turma / equipa</label>
            <select value={turma} onChange={(e) => { setTurma(e.target.value); setErro(""); }} style={{ ...inputStyle, width: 175 }}>
              <option value="">{turmasEscola.length ? "Selecionar..." : "Sem turmas nesta escola"}</option>
              {turmasEscola.map((t) => (
                <option key={t.turma} value={t.turma}>
                  {t.turma} ({t.m + t.f}/{t.cap || capacidadeSugerida(t.turma, niveis)})
                </option>
              ))}
            </select>
          </div>
          <button onClick={guardar} style={{ ...primaryBtnStyle, flex: "none", padding: "9px 16px" }}>Atribuir</button>
        </div>
        {erro && <div style={{ color: COLORS.danger, fontSize: 13, marginTop: 8 }}>{erro}</div>}
      </div>

      <div style={panelStyle}>
        <div style={panelTitle}>Mapa de ocupação — {escola}</div>
        {doEscola.length === 0 && <div style={{ fontSize: 13, color: COLORS.slate, marginBottom: 12 }}>Sem atribuições nesta escola.</div>}
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Espaço</th>
                {DIAS_SEMANA.map((d) => (
                  <th key={d} style={thStyle}>{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mostrar.map((sp) => (
                <tr key={sp}>
                  <td style={{ ...tdStyle, fontWeight: 600, whiteSpace: "nowrap" }}>{sp}</td>
                  {DIAS_SEMANA.map((d) => {
                    const blocos = doEscola
                      .filter((s) => s.espaco === sp && s.dia === d)
                      .sort((a, b) => String(a.hora).localeCompare(String(b.hora)));
                    return (
                      <td key={d} style={{ ...tdStyle, verticalAlign: "top", minWidth: 150 }}>
                        {blocos.length === 0 ? (
                          <span style={{ color: COLORS.rule }}>—</span>
                        ) : (
                          blocos.map((b) => {
                            const info = infoTurma(b.turma);
                            return (
                              <div
                                key={b.id}
                                style={{
                                  background: COLORS.paper,
                                  border: `1px solid ${COLORS.rule}`,
                                  borderLeft: `3px solid ${info ? corLotacao(info.pct) : COLORS.rule}`,
                                  borderRadius: 3,
                                  padding: "6px 8px",
                                  marginBottom: 5,
                                }}
                              >
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                                  <span style={{ fontVariantNumeric: "tabular-nums", fontSize: 11.5, color: COLORS.navy }}>{b.hora}</span>
                                  <button title="Remover" onClick={() => onRemove(b.id)} style={{ ...iconBtnStyle, padding: 0 }}>
                                    <X size={11} />
                                  </button>
                                </div>
                                <div style={{ fontSize: 12.5, fontWeight: 600, margin: "2px 0" }}>{b.turma}</div>
                                {info ? (
                                  <>
                                    <div style={{ fontSize: 11, color: COLORS.slate, marginBottom: 3 }}>
                                      {info.total} de {info.cap} atletas
                                    </div>
                                    <BarraLotacao pct={info.pct} largura={62} />
                                  </>
                                ) : (
                                  <div style={{ fontSize: 11, color: COLORS.warn }}>turma sem registo de alunos</div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ fontSize: 11.5, color: COLORS.slate, marginTop: 10 }}>
          A lotação de cada bloco vem automaticamente do registo de alunos dessa turma.
        </div>
      </div>
    </div>
  );
}

// ---------- Eventos ----------
function SecaoEventos({ escolas, eventos, onSave, onRemove }) {
  const [nome, setNome] = useState("");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [escola, setEscola] = useState(escolas[0] || "");
  const [nTurmas, setNTurmas] = useState("");
  const [nComp, setNComp] = useState("");
  const [satisf, setSatisf] = useState("");
  const [reclam, setReclam] = useState("");
  const [erro, setErro] = useState("");

  const [fEsc, setFEsc] = useState("todas");
  const [fMes, setFMes] = useState("todos");

  const meses = [...new Set(eventos.map((e) => mesDeData(e.data)).filter(Boolean))].sort().reverse();
  const lista = eventos
    .filter((e) => (fEsc === "todas" ? true : e.escola === fEsc))
    .filter((e) => (fMes === "todos" ? true : mesDeData(e.data) === fMes))
    .sort((a, b) => String(b.data).localeCompare(String(a.data)));

  const totalInscritos = lista.reduce((s, e) => s + (e.nTurmas || 0) + (e.nComp || 0), 0);
  const totalReclam = lista.reduce((s, e) => s + (e.reclamacoes || 0), 0);
  const comSatisf = lista.filter((e) => e.satisfacao !== null && e.satisfacao !== undefined);
  const satisfMedia = comSatisf.length ? Math.round(comSatisf.reduce((s, e) => s + e.satisfacao, 0) / comSatisf.length) : null;

  // Um evento pode envolver várias escolas: agrupa-se pelo nome + data.
  const porEvento = [...new Map(lista.map((e) => [`${e.nome}|${e.data}`, e])).keys()].map((k) => {
    const [nm, dt] = k.split("|");
    const linhas = lista.filter((e) => e.nome === nm && e.data === dt);
    return {
      nome: nm,
      data: dt,
      escolas: linhas.length,
      turmas: linhas.reduce((s, e) => s + (e.nTurmas || 0), 0),
      comp: linhas.reduce((s, e) => s + (e.nComp || 0), 0),
      reclam: linhas.reduce((s, e) => s + (e.reclamacoes || 0), 0),
    };
  });

  const guardar = () => {
    if (!nome.trim()) {
      setErro("Dá um nome ao evento.");
      return;
    }
    if (nTurmas === "" && nComp === "") {
      setErro("Indica os inscritos de turmas e/ou de competição.");
      return;
    }
    const sv = satisf === "" ? null : Math.max(0, Math.min(100, Math.round(Number(satisf))));
    setErro("");
    onSave({
      id: `ev_${Date.now()}`,
      nome: nome.trim(),
      data,
      escola,
      nTurmas: Math.round(Number(nTurmas || 0)),
      nComp: Math.round(Number(nComp || 0)),
      satisfacao: sv,
      reclamacoes: Math.round(Number(reclam || 0)),
    });
    setNTurmas("");
    setNComp("");
    setSatisf("");
    setReclam("");
  };

  return (
    <div>
      <div style={{ ...panelStyle, marginBottom: 16 }}>
        <div style={panelTitle}>Registar participação num evento</div>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div>
            <label style={{ ...labelStyle, marginTop: 0 }}>Evento</label>
            <input
              type="text"
              value={nome}
              onChange={(e) => { setNome(e.target.value); setErro(""); }}
              placeholder="Ex: Torneio de Natal"
              list="lista-eventos"
              style={{ ...inputStyle, width: 210 }}
            />
            <datalist id="lista-eventos">
              {[...new Set(eventos.map((e) => e.nome))].map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </div>
          <div>
            <label style={{ ...labelStyle, marginTop: 0 }}>Data</label>
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} style={{ ...inputStyle, width: 155 }} />
          </div>
          <div>
            <label style={{ ...labelStyle, marginTop: 0 }}>Escola</label>
            <select value={escola} onChange={(e) => setEscola(e.target.value)} style={{ ...inputStyle, width: 165 }}>
              {escolas.map((e) => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ ...labelStyle, marginTop: 0 }}>Inscritos de turmas</label>
            <input type="number" min="0" value={nTurmas} onChange={(e) => { setNTurmas(e.target.value); setErro(""); }} style={{ ...inputStyle, width: 150 }} placeholder="0" />
          </div>
          <div>
            <label style={{ ...labelStyle, marginTop: 0 }}>Inscritos de competição</label>
            <input type="number" min="0" value={nComp} onChange={(e) => { setNComp(e.target.value); setErro(""); }} style={{ ...inputStyle, width: 165 }} placeholder="0" />
          </div>
          <div>
            <label style={{ ...labelStyle, marginTop: 0 }}>Satisfação (%)</label>
            <input type="number" min="0" max="100" value={satisf} onChange={(e) => setSatisf(e.target.value)} style={{ ...inputStyle, width: 130 }} placeholder="—" />
          </div>
          <div>
            <label style={{ ...labelStyle, marginTop: 0 }}>Reclamações</label>
            <input type="number" min="0" value={reclam} onChange={(e) => setReclam(e.target.value)} style={{ ...inputStyle, width: 120 }} placeholder="0" />
          </div>
          <button onClick={guardar} style={{ ...primaryBtnStyle, flex: "none", padding: "9px 16px" }}>Registar</button>
        </div>
        {erro && <div style={{ color: COLORS.danger, fontSize: 13, marginTop: 8 }}>{erro}</div>}
        <div style={{ fontSize: 11.5, color: COLORS.slate, marginTop: 9 }}>
          Uma linha por escola. Repete o mesmo nome e data para juntar várias escolas no mesmo evento.
        </div>
      </div>

      <Filtros>
        <select value={fEsc} onChange={(e) => setFEsc(e.target.value)} style={{ ...inputStyle, width: 180 }}>
          <option value="todas">Todas as escolas</option>
          {escolas.map((e) => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>
        <select value={fMes} onChange={(e) => setFMes(e.target.value)} style={{ ...inputStyle, width: 160 }}>
          <option value="todos">Todos os meses</option>
          {meses.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </Filtros>

      <div style={{ display: "flex", gap: 14, marginBottom: 16, flexWrap: "wrap" }}>
        <StatCard label="Eventos" value={porEvento.length} />
        <StatCard label="Participações" value={totalInscritos} subtitle="turmas + competição" />
        <StatCard label="Satisfação média" value={satisfMedia === null ? "—" : `${satisfMedia}%`} color={COLORS.ok} />
        <StatCard label="Reclamações" value={totalReclam} color={totalReclam ? COLORS.danger : COLORS.navy} />
      </div>

      {lista.length === 0 ? (
        <SemDados texto="Sem eventos registados para os filtros selecionados." />
      ) : (
        <>
          {porEvento.length > 0 && (
            <div style={{ ...panelStyle, marginBottom: 16 }}>
              <div style={panelTitle}>Participação por evento</div>
              <ResponsiveContainer width="100%" height={Math.max(200, porEvento.length * 40)}>
                <BarChart data={porEvento} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid stroke={COLORS.ruleSoft} strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: COLORS.slate }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="nome" width={150} tick={{ fontSize: 11.5, fill: COLORS.ink }} axisLine={false} tickLine={false} />
                  <Tooltip content={<DicaGrafico />} cursor={{ fill: COLORS.ruleSoft }} />
                  <Bar dataKey="turmas" name="Turmas" stackId="e" fill={COLORS.purple} />
                  <Bar dataKey="comp" name="Competição" stackId="e" fill={COLORS.progress} />
                </BarChart>
              </ResponsiveContainer>
              <div style={{ display: "flex", justifyContent: "center", gap: 14, fontSize: 11.5, marginTop: 6 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 9, height: 9, borderRadius: 2, background: COLORS.purple }} /> Turmas
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 9, height: 9, borderRadius: 2, background: COLORS.progress }} /> Competição
                </span>
              </div>
            </div>
          )}

          <div style={panelStyle}>
            <div style={panelTitle}>Registos ({lista.length})</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Data", "Evento", "Escola", "Turmas", "Competição", "Total", "Satisfação", "Reclamações", ""].map((h) => (
                      <th key={h} style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lista.map((e) => (
                    <tr key={e.id}>
                      <td style={{ ...tdStyle, fontVariantNumeric: "tabular-nums", fontSize: 12 }}>{e.data}</td>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{e.nome}</td>
                      <td style={tdStyle}>{e.escola}</td>
                      <td style={tdStyle}>{e.nTurmas || 0}</td>
                      <td style={tdStyle}>{e.nComp || 0}</td>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{(e.nTurmas || 0) + (e.nComp || 0)}</td>
                      <td style={tdStyle}>
                        {e.satisfacao === null || e.satisfacao === undefined ? (
                          "—"
                        ) : (
                          <Tag
                            label={`${e.satisfacao}%`}
                            color={e.satisfacao >= 80 ? COLORS.ok : e.satisfacao >= 60 ? COLORS.warn : COLORS.danger}
                            bg={e.satisfacao >= 80 ? COLORS.okBg : e.satisfacao >= 60 ? COLORS.warnBg : COLORS.dangerBg}
                          />
                        )}
                      </td>
                      <td style={{ ...tdStyle, color: e.reclamacoes ? COLORS.danger : COLORS.slate, fontWeight: e.reclamacoes ? 600 : 400 }}>
                        {e.reclamacoes || 0}
                      </td>
                      <td style={tdStyle}>
                        <button title="Remover" onClick={() => onRemove(e.id)} style={{ ...iconBtnStyle, padding: 0 }}>
                          <X size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ---------- Satisfação ----------
function SecaoSatisfacao({ escolas, turmas, niveis, categorias, satisfacao, onSave, onRemove, onGerirLista }) {
  const [escola, setEscola] = useState(escolas[0] || "");
  const [escalao, setEscalao] = useState("");
  const [periodo, setPeriodo] = useState(new Date().toISOString().slice(0, 7));
  const [respostas, setRespostas] = useState("");
  const [valores, setValores] = useState({});
  const [erro, setErro] = useState("");

  const [fEsc, setFEsc] = useState("todas");
  const [fEsca, setFEsca] = useState("todos");
  const [fPer, setFPer] = useState("todos");

  const escaloes = useMemo(() => {
    const usados = [...new Set(turmas.map((t) => escalaoDaTurma(t.turma, niveis)))];
    return usados.sort();
  }, [turmas, niveis]);

  const periodos = [...new Set(satisfacao.map((s) => s.periodo).filter(Boolean))].sort().reverse();

  const lista = satisfacao
    .filter((s) => (fEsc === "todas" ? true : s.escola === fEsc))
    .filter((s) => (fEsca === "todos" ? true : s.escalao === fEsca))
    .filter((s) => (fPer === "todos" ? true : s.periodo === fPer))
    .sort((a, b) => String(b.periodo).localeCompare(String(a.periodo)));

  // Média ponderada pelo número de respostas, que é o correto para inquéritos.
  const mediaPonderada = (regs, cat) => {
    let peso = 0;
    let soma = 0;
    regs.forEach((r) => {
      const v = cat ? (r.valores || {})[cat] : mediaRegisto(r);
      if (v === undefined || v === null || isNaN(v)) return;
      const p = r.respostas || 1;
      soma += v * p;
      peso += p;
    });
    return peso ? Math.round(soma / peso) : null;
  };
  function mediaRegisto(r) {
    const vs = Object.values(r.valores || {}).filter((v) => v !== null && v !== undefined && !isNaN(v));
    return vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : null;
  }

  const global = mediaPonderada(lista);
  const totalRespostas = lista.reduce((s, r) => s + (r.respostas || 0), 0);

  const porCategoria = categorias
    .map((c) => ({ name: c, valor: mediaPonderada(lista, c) }))
    .filter((x) => x.valor !== null)
    .sort((a, b) => b.valor - a.valor);
  const porEscola = escolas
    .map((e) => ({ name: e, valor: mediaPonderada(lista.filter((s) => s.escola === e)) }))
    .filter((x) => x.valor !== null);
  const porEscalao = escaloes
    .map((x) => ({ name: x, valor: mediaPonderada(lista.filter((s) => s.escalao === x)) }))
    .filter((y) => y.valor !== null);
  const porPeriodo = [...new Set(lista.map((s) => s.periodo))].sort().map((p) => ({
    name: p,
    valor: mediaPonderada(lista.filter((s) => s.periodo === p)),
  }));

  const corSat = (v) => (v >= 80 ? COLORS.ok : v >= 60 ? COLORS.warn : COLORS.danger);

  const guardar = () => {
    const preenchidos = Object.entries(valores).filter(([, v]) => v !== "" && v !== null);
    if (preenchidos.length === 0) {
      setErro("Preenche pelo menos uma categoria.");
      return;
    }
    if (respostas === "" || Number(respostas) < 1) {
      setErro("Indica quantas respostas recebeste (usado para ponderar as médias).");
      return;
    }
    setErro("");
    const vals = {};
    preenchidos.forEach(([k, v]) => (vals[k] = Math.max(0, Math.min(100, Math.round(Number(v))))));
    onSave({
      id: `sat_${Date.now()}`,
      escola,
      escalao: escalao || "Todos",
      periodo,
      respostas: Math.round(Number(respostas)),
      valores: vals,
      data: new Date().toISOString().slice(0, 10),
    });
    setValores({});
    setRespostas("");
  };

  const grafico = (dados, titulo, cor) => (
    <div style={{ ...panelStyle, flex: "1 1 330px" }}>
      <div style={panelTitle}>{titulo}</div>
      {dados.length === 0 ? (
        <div style={{ fontSize: 13, color: COLORS.slate }}>Sem dados.</div>
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(180, dados.length * 34)}>
          <BarChart data={dados} layout="vertical" margin={{ left: 8 }}>
            <CartesianGrid stroke={COLORS.ruleSoft} strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: COLORS.slate }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
            <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 11.5, fill: COLORS.ink }} axisLine={false} tickLine={false} />
            <Tooltip content={<DicaGrafico sufixo="%" />} cursor={{ fill: COLORS.ruleSoft }} />
            <Bar dataKey="valor" radius={[0, 3, 3, 0]} barSize={16}>
              {dados.map((d, i) => (
                <Cell key={i} fill={cor || corSat(d.valor)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );

  return (
    <div>
      <div style={{ ...panelStyle, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div style={panelTitle}>Registar resultados de inquérito</div>
          <button type="button" onClick={() => onGerirLista("categoriasSatisfacao")} style={{ ...linkBtnStyle, marginTop: 0 }}>Gerir categorias</button>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 14 }}>
          <div>
            <label style={{ ...labelStyle, marginTop: 0 }}>Escola</label>
            <select value={escola} onChange={(e) => setEscola(e.target.value)} style={{ ...inputStyle, width: 165 }}>
              {escolas.map((e) => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ ...labelStyle, marginTop: 0 }}>Escalão</label>
            <select value={escalao} onChange={(e) => setEscalao(e.target.value)} style={{ ...inputStyle, width: 170 }}>
              <option value="">Todos os escalões</option>
              {escaloes.map((x) => (
                <option key={x} value={x}>{x}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ ...labelStyle, marginTop: 0 }}>Período</label>
            <input type="month" value={periodo} onChange={(e) => setPeriodo(e.target.value)} style={{ ...inputStyle, width: 160 }} />
          </div>
          <div>
            <label style={{ ...labelStyle, marginTop: 0 }}>Nº de respostas</label>
            <input type="number" min="1" value={respostas} onChange={(e) => { setRespostas(e.target.value); setErro(""); }} style={{ ...inputStyle, width: 140 }} placeholder="24" />
          </div>
        </div>

        <div style={{ fontSize: 11.5, fontWeight: 600, color: COLORS.slate, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
          Satisfação por categoria (%)
        </div>
        {categorias.length === 0 ? (
          <div style={{ fontSize: 13, color: COLORS.slate }}>Sem categorias. Usa "Gerir categorias" para as criar.</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 10 }}>
            {categorias.map((c) => (
              <div key={c}>
                <label style={{ ...labelStyle, marginTop: 0 }}>{c}</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={valores[c] ?? ""}
                  onChange={(e) => { setValores((v) => ({ ...v, [c]: e.target.value })); setErro(""); }}
                  style={{ ...inputStyle, width: "100%" }}
                  placeholder="—"
                />
              </div>
            ))}
          </div>
        )}
        <button onClick={guardar} style={{ ...primaryBtnStyle, flex: "none", padding: "9px 16px", marginTop: 14 }}>Guardar</button>
        {erro && <div style={{ color: COLORS.danger, fontSize: 13, marginTop: 8 }}>{erro}</div>}
      </div>

      <Filtros>
        <select value={fEsc} onChange={(e) => setFEsc(e.target.value)} style={{ ...inputStyle, width: 175 }}>
          <option value="todas">Todas as escolas</option>
          {escolas.map((e) => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>
        <select value={fEsca} onChange={(e) => setFEsca(e.target.value)} style={{ ...inputStyle, width: 175 }}>
          <option value="todos">Todos os escalões</option>
          {[...new Set(satisfacao.map((s) => s.escalao))].sort().map((x) => (
            <option key={x} value={x}>{x}</option>
          ))}
        </select>
        <select value={fPer} onChange={(e) => setFPer(e.target.value)} style={{ ...inputStyle, width: 160 }}>
          <option value="todos">Todos os períodos</option>
          {periodos.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </Filtros>

      {lista.length === 0 ? (
        <SemDados texto="Sem resultados de satisfação para os filtros selecionados." />
      ) : (
        <>
          <div style={{ display: "flex", gap: 14, marginBottom: 16, flexWrap: "wrap" }}>
            <StatCard
              label="Satisfação global"
              value={global === null ? "—" : `${global}%`}
              color={global === null ? COLORS.navy : corSat(global)}
              subtitle={`ponderada por ${totalRespostas} respostas`}
              anel={global}
            />
            <StatCard label="Inquéritos registados" value={lista.length} />
            <StatCard
              label="Melhor categoria"
              value={porCategoria.length ? `${porCategoria[0].valor}%` : "—"}
              color={COLORS.ok}
              subtitle={porCategoria.length ? porCategoria[0].name : ""}
            />
            <StatCard
              label="Categoria mais fraca"
              value={porCategoria.length ? `${porCategoria[porCategoria.length - 1].valor}%` : "—"}
              color={COLORS.danger}
              subtitle={porCategoria.length ? porCategoria[porCategoria.length - 1].name : ""}
            />
          </div>

          {porPeriodo.length > 1 && (
            <div style={{ ...panelStyle, marginBottom: 16 }}>
              <div style={panelTitle}>Evolução da satisfação global</div>
              <ResponsiveContainer width="100%" height={230}>
                <LineChart data={porPeriodo}>
                  <CartesianGrid stroke={COLORS.ruleSoft} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: COLORS.slate }} axisLine={{ stroke: COLORS.rule }} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: COLORS.slate }} axisLine={false} tickLine={false} width={38} tickFormatter={(v) => `${v}%`} />
                  <Tooltip content={<DicaGrafico sufixo="%" />} cursor={{ fill: COLORS.ruleSoft }} />
                  <Line type="monotone" dataKey="valor" stroke={COLORS.navy} strokeWidth={2.5} dot={{ r: 4, fill: COLORS.navy }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
            {grafico(porCategoria, "Satisfação por categoria")}
            {grafico(porEscola, "Satisfação por escola")}
          </div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
            {grafico(porEscalao, "Satisfação por escalão")}
            <div style={{ ...panelStyle, flex: "1 1 330px" }}>
              <div style={panelTitle}>Registos ({lista.length})</div>
              <div style={{ overflowX: "auto", maxHeight: 300, overflowY: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      {["Período", "Escola", "Escalão", "Respostas", "Média", ""].map((h) => (
                        <th key={h} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {lista.map((s) => {
                      const m = mediaRegisto(s);
                      return (
                        <tr key={s.id}>
                          <td style={{ ...tdStyle, fontVariantNumeric: "tabular-nums", fontSize: 12 }}>{s.periodo}</td>
                          <td style={tdStyle}>{s.escola}</td>
                          <td style={{ ...tdStyle, fontSize: 12.5 }}>{s.escalao}</td>
                          <td style={tdStyle}>{s.respostas}</td>
                          <td style={tdStyle}>
                            {m === null ? "—" : <Tag label={`${Math.round(m)}%`} color={corSat(m)} bg={m >= 80 ? COLORS.okBg : m >= 60 ? COLORS.warnBg : COLORS.dangerBg} />}
                          </td>
                          <td style={tdStyle}>
                            <button title="Remover" onClick={() => onRemove(s.id)} style={{ ...iconBtnStyle, padding: 0 }}>
                              <X size={13} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ---------- Importar alunos por turma ----------
// Aceita colar diretamente do Excel (colunas separadas por tabulação) ou um
// ficheiro CSV. Não usa bibliotecas: o Excel copia em texto tabulado e o
// "Guardar como CSV" produz texto simples, por isso basta partir linhas.
function lerTabela(texto) {
  const linhas = String(texto)
    .replace(/\r/g, "")
    .split("\n")
    .filter((l) => l.trim() !== "");
  if (linhas.length === 0) return [];
  // Separador: tabulação (colado do Excel), ponto e vírgula (CSV português) ou vírgula.
  const primeira = linhas[0];
  const sep = primeira.includes("\t") ? "\t" : primeira.includes(";") ? ";" : ",";
  return linhas.map((l) =>
    l.split(sep).map((c) => c.trim().replace(/^"(.*)"$/, "$1"))
  );
}

const COLUNAS_IMPORT = [
  { chave: "escola", rotulo: "Escola", sinonimos: ["escola", "polo", "polo/escola", "school"] },
  { chave: "turma", rotulo: "Turma / equipa", sinonimos: ["turma", "equipa", "escalao", "escalão", "classe"] },
  { chave: "ano", rotulo: "Ano de nascimento", sinonimos: ["ano", "ano de nascimento", "nascimento", "anonascimento"] },
  { chave: "m", rotulo: "Masculinos", sinonimos: ["m", "masculinos", "masculino", "rapazes", "h"] },
  { chave: "f", rotulo: "Femininos", sinonimos: ["f", "femininos", "feminino", "raparigas"] },
];

function normCab(t) {
  return String(t || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function ImportarAlunos({ escolas, turmas, onImportar, onFechar, notificar }) {
  const [texto, setTexto] = useState("");
  const [mapa, setMapa] = useState({});
  const [temCabecalho, setTemCabecalho] = useState(true);
  const [erro, setErro] = useState("");

  const tabela = useMemo(() => lerTabela(texto), [texto]);
  const nCols = tabela.length ? Math.max(...tabela.map((l) => l.length)) : 0;

  // Tenta adivinhar as colunas a partir dos títulos.
  useEffect(() => {
    if (!tabela.length || !temCabecalho) return;
    const cab = tabela[0].map(normCab);
    const novo = {};
    COLUNAS_IMPORT.forEach((c) => {
      const i = cab.findIndex((h) => c.sinonimos.includes(h));
      if (i >= 0) novo[c.chave] = String(i);
    });
    setMapa(novo);
  }, [texto, temCabecalho]);

  const linhasDados = temCabecalho ? tabela.slice(1) : tabela;

  const processadas = useMemo(() => {
    if (!linhasDados.length) return [];
    return linhasDados.map((linha, idx) => {
      const val = (chave) => {
        const i = mapa[chave];
        return i === undefined || i === "" ? "" : (linha[Number(i)] || "").trim();
      };
      const escola = val("escola");
      const turma = val("turma");
      const anoTxt = val("ano");
      const m = val("m");
      const f = val("f");
      const ano = parseInt(String(anoTxt).replace(/\D/g, ""), 10);
      const problemas = [];
      if (!escola) problemas.push("sem escola");
      else if (!escolas.includes(escola)) problemas.push(`escola "${escola}" não existe`);
      if (!turma) problemas.push("sem turma");
      else if (!turmas.includes(turma)) problemas.push(`turma "${turma}" não existe`);
      if (!anoTxt || isNaN(ano) || ano < 1990 || ano > new Date().getFullYear()) problemas.push("ano inválido");
      const mn = m === "" ? 0 : Number(String(m).replace(",", "."));
      const fn = f === "" ? 0 : Number(String(f).replace(",", "."));
      if (isNaN(mn) || mn < 0) problemas.push("masculinos inválido");
      if (isNaN(fn) || fn < 0) problemas.push("femininos inválido");
      if (!problemas.length && mn + fn === 0) problemas.push("sem atletas");
      return {
        linha: idx + (temCabecalho ? 2 : 1),
        escola,
        turma,
        ano,
        m: Math.round(mn) || 0,
        f: Math.round(fn) || 0,
        problemas,
      };
    });
  }, [linhasDados, mapa, escolas, turmas, temCabecalho]);

  const validas = processadas.filter((p) => p.problemas.length === 0);
  const invalidas = processadas.filter((p) => p.problemas.length > 0);
  const totalAtletas = validas.reduce((t, p) => t + p.m + p.f, 0);

  const carregarFicheiro = (ev) => {
    const ficheiro = ev.target.files && ev.target.files[0];
    if (!ficheiro) return;
    if (/\.xlsx?$/i.test(ficheiro.name)) {
      setErro('Ficheiros .xls e .xlsx não são lidos diretamente. No Excel usa "Guardar como" → CSV, ou copia as células e cola na caixa abaixo.');
      ev.target.value = "";
      return;
    }
    setErro("");
    const leitor = new FileReader();
    leitor.onload = () => setTexto(String(leitor.result || ""));
    leitor.onerror = () => setErro("Não foi possível ler o ficheiro.");
    leitor.readAsText(ficheiro, "UTF-8");
    ev.target.value = "";
  };

  const confirmar = () => {
    if (!validas.length) {
      setErro("Não há linhas válidas para importar.");
      return;
    }
    onImportar(validas.map(({ escola, turma, ano, m, f }) => ({ escola, turma, ano, m, f })));
    notificar(`${validas.length} linha(s) importada(s), ${totalAtletas} atletas.`);
    onFechar();
  };

  const th = { textAlign: "left", fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.05em", color: COLORS.slate, padding: "7px 9px", borderBottom: `1px solid ${COLORS.rule}` };
  const td = { padding: "7px 9px", borderBottom: `1px solid ${COLORS.ruleSoft}`, fontSize: 12.5 };

  return (
    <div
      className="veil"
      style={{ position: "fixed", inset: 0, background: "rgba(8,14,24,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 70, padding: 16 }}
      onClick={onFechar}
    >
      <div
        className="sheet"
        style={{
          width: "min(760px, 100%)",
          maxHeight: "calc(100vh - 32px)",
          overflowY: "auto",
          background: COLORS.paperRaised,
          border: `1px solid ${COLORS.rule}`,
          borderRadius: 14,
          padding: "20px 22px 22px",
          boxShadow: "0 20px 50px -12px rgba(8,14,24,0.35)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 4 }}>
          <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.015em" }}>Importar alunos por turma</div>
          <button onClick={onFechar} style={{ ...iconBtnStyle, padding: 0 }} aria-label="Fechar">
            <X size={17} />
          </button>
        </div>
        <div style={{ fontSize: 12.5, color: COLORS.ink2, lineHeight: 1.5, marginBottom: 16 }}>
          Copia as células no Excel e cola aqui, ou carrega um ficheiro CSV. Precisas das colunas escola, turma, ano de
          nascimento, masculinos e femininos — apenas números, sem nomes de atletas.
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
          <label
            className="press"
            style={{ ...secondaryBtnStyle, flex: "none", padding: "8px 14px", display: "inline-flex", alignItems: "center", gap: 7, cursor: "pointer" }}
          >
            <input type="file" accept=".csv,.tsv,.txt,text/csv" onChange={carregarFicheiro} style={{ display: "none" }} />
            Carregar CSV
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, color: COLORS.ink2 }}>
            <input type="checkbox" checked={temCabecalho} onChange={(e) => setTemCabecalho(e.target.checked)} />
            A primeira linha são os títulos das colunas
          </label>
          {texto && (
            <button onClick={() => { setTexto(""); setMapa({}); setErro(""); }} style={{ ...linkBtnStyle, marginTop: 0, marginLeft: "auto" }}>
              Limpar
            </button>
          )}
        </div>

        <textarea
          rows={6}
          value={texto}
          onChange={(e) => { setTexto(e.target.value); setErro(""); }}
          placeholder={"Escola\tTurma\tAno\tM\tF\nDragon Force Gondomar\tSub-10\t2016\t14\t2\nDragon Force Gondomar\tRaíz\t2020\t9\t3"}
          style={{ ...inputStyle, resize: "vertical", fontFamily: "'IBM Plex Mono', ui-monospace, monospace", fontSize: 12.5, lineHeight: 1.6 }}
        />

        {nCols > 0 && (
          <>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: COLORS.slate, textTransform: "uppercase", letterSpacing: "0.05em", margin: "16px 0 8px" }}>
              Que coluna corresponde a quê
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 14 }}>
              {COLUNAS_IMPORT.map((c) => (
                <div key={c.chave}>
                  <label style={{ ...labelStyle, marginTop: 0 }}>{c.rotulo}</label>
                  <select
                    value={mapa[c.chave] ?? ""}
                    onChange={(e) => setMapa((mp) => ({ ...mp, [c.chave]: e.target.value }))}
                    style={inputStyle}
                  >
                    <option value="">—</option>
                    {Array.from({ length: nCols }).map((_, i) => (
                      <option key={i} value={String(i)}>
                        {temCabecalho && tabela[0][i] ? tabela[0][i] : `Coluna ${i + 1}`}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </>
        )}

        {processadas.length > 0 && (
          <>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
              <Tag label={`${validas.length} linha(s) pronta(s)`} color={COLORS.ok} bg={COLORS.okBg} />
              {invalidas.length > 0 && <Tag label={`${invalidas.length} com problemas`} color={COLORS.danger} bg={COLORS.dangerBg} />}
              <Tag label={`${totalAtletas} atletas`} color={COLORS.navySoft} bg={COLORS.navyWash} />
            </div>

            <div style={{ border: `1px solid ${COLORS.rule}`, borderRadius: 10, overflow: "hidden", maxHeight: 260, overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Linha", "Escola", "Turma", "Ano", "M", "F", "Estado"].map((h) => (
                      <th key={h} style={th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {processadas.slice(0, 60).map((p) => (
                    <tr key={p.linha} style={{ background: p.problemas.length ? COLORS.dangerBg : "transparent" }}>
                      <td style={{ ...td, color: COLORS.slate, fontVariantNumeric: "tabular-nums" }}>{p.linha}</td>
                      <td style={td}>{p.escola || "—"}</td>
                      <td style={td}>{p.turma || "—"}</td>
                      <td style={{ ...td, fontVariantNumeric: "tabular-nums" }}>{isNaN(p.ano) ? "—" : p.ano}</td>
                      <td style={{ ...td, fontVariantNumeric: "tabular-nums" }}>{p.m}</td>
                      <td style={{ ...td, fontVariantNumeric: "tabular-nums" }}>{p.f}</td>
                      <td style={{ ...td, fontSize: 11.5, color: p.problemas.length ? COLORS.danger : COLORS.ok }}>
                        {p.problemas.length ? p.problemas.join("; ") : "pronta"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {processadas.length > 60 && (
              <div style={{ fontSize: 11.5, color: COLORS.slate, marginTop: 8 }}>
                A mostrar as primeiras 60 de {processadas.length} linhas.
              </div>
            )}
          </>
        )}

        {erro && <div style={{ color: COLORS.danger, fontSize: 13, marginTop: 12 }}>{erro}</div>}

        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
          <button onClick={onFechar} style={secondaryBtnStyle}>
            Cancelar
          </button>
          <button
            className="press"
            onClick={confirmar}
            disabled={!validas.length}
            style={{ ...primaryBtnStyle, opacity: validas.length ? 1 : 0.5, cursor: validas.length ? "pointer" : "default" }}
          >
            Importar {validas.length || ""} linha(s)
          </button>
        </div>
        <div style={{ fontSize: 11.5, color: COLORS.slate, marginTop: 10, lineHeight: 1.5 }}>
          Linhas com a mesma escola, turma e ano substituem o registo existente. As que têm problemas são ignoradas.
        </div>
      </div>
    </div>
  );
}

// ---------- Inscritos: registo semanal, turmas e análise ----------

function TurmaChip({ label, onDelete }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        background: COLORS.doneBg,
        border: `1px solid ${COLORS.rule}`,
        borderRadius: 20,
        padding: "5px 11px",
        fontSize: 12.5,
      }}
    >
      {label}
      <button onClick={onDelete} style={{ ...iconBtnStyle, padding: 0, lineHeight: 0 }} title="Remover">
        <X size={12} />
      </button>
    </span>
  );
}


const INSC_PARAMS = [
  { key: "classes", label: "Classificação de crescimento" },
  { key: "quad", label: "Matriz de quadrantes" },
  { key: "evolucao", label: "Evolução de inscritos" },
  { key: "crescimento", label: "Crescimento (%)" },
  { key: "escalao", label: "Alunos por escalão" },
  { key: "escolinha", label: "Escolinha por nível" },
  { key: "genero", label: "Distribuição por género" },
  { key: "ano", label: "Ano de nascimento" },
  { key: "homologo", label: "Comparação homóloga" },
  { key: "fluxo", label: "Novas inscrições vs desistências" },
];

// Agrega a série semanal de uma escola: por semana (tal e qual) ou por mês
// (o valor de inscritos é o da última semana do mês, porque é o retrato real
// nessa altura; novas e desistências somam-se).
function agregaSerie(registos, periodo) {
  const ordenados = [...registos].sort((a, b) => a.semana.localeCompare(b.semana));
  if (periodo === "semana") {
    return ordenados.map((r) => ({ label: semanaLabel(r.semana), total: r.total, novas: r.novas || 0, desist: r.desist || 0 }));
  }
  const porMes = new Map();
  ordenados.forEach((r) => {
    const m = mesDaSemana(r.semana);
    const atual = porMes.get(m) || { label: m, total: 0, novas: 0, desist: 0 };
    atual.total = r.total;
    atual.novas += r.novas || 0;
    atual.desist += r.desist || 0;
    porMes.set(m, atual);
  });
  return [...porMes.values()];
}

const SECOES_GESTAO = [
  ["registo", "Turmas e lotação"],
  ["experiencias", "Experiências"],
  ["desistencias", "Desistências"],
  ["desvinc", "Desvinculações"],
  ["espacos", "Espaços"],
  ["eventos", "Eventos"],
  ["satisfacao", "Satisfação"],
  ["analise", "Análise"],
];

function InscritosPage({
  inscritos,
  turmasAlunos,
  epocaAnterior,
  options,
  desistencias,
  experiencias,
  desvinculacoes,
  espacos,
  eventos,
  satisfacao,
  onSaveSemana,
  onRetrato,
  onImportarTurmas,
  notificar,
  onSaveTurma,
  onRemoveTurma,
  onSaveEpocaAnterior,
  onToggleTurmaEscola,
  onAddOption,
  onRemoveOption,
  onSaveDesistencia,
  onRemoveDesistencia,
  onSaveExperiencia,
  onUpdateExperiencia,
  onRemoveExperiencia,
  onSaveDesvinc,
  onUpdateDesvinc,
  onRemoveDesvinc,
  onSaveEspaco,
  onRemoveEspaco,
  onSaveEvento,
  onRemoveEvento,
  onSaveSatisfacao,
  onRemoveSatisfacao,
  onGerirLista,
}) {
  const [view, setView] = useState("registo");
  const escolas = options.schools || [];
  const niveis = options.niveis || DEFAULT_NIVEIS;

  return (
    <div>
      <div
        style={{
          display: "inline-flex",
          gap: 3,
          background: COLORS.segTrack,
          border: "none",
          borderRadius: 9,
          padding: 2,
          marginBottom: 20,
          flexWrap: "wrap",
        }}
      >
        {SECOES_GESTAO.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setView(key)}
            className="pill"
            style={{
              background: view === key ? COLORS.paperRaised : "transparent",
              border: "none",
              borderRadius: 7,
              padding: "7px 14px",
              fontSize: 13.5,
              fontWeight: view === key ? 600 : 500,
              color: view === key ? COLORS.ink : COLORS.ink2,
              cursor: "pointer",
              boxShadow: view === key ? "0 1px 3px rgba(0,0,0,0.12)" : "none",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div key={view} className="pageIn">
      {escolas.length === 0 ? (
        <Vazio
          icon={Users}
          titulo="Ainda não há escolas"
          texto="As escolas são partilhadas por toda a app. Cria-as primeiro e depois atribuis turmas a cada uma."
          acao="Escolas e listas"
          onAcao={() => onGerirLista("schools")}
        />
      ) : view === "experiencias" ? (
        <SecaoExperiencias
          escolas={escolas}
          turmas={turmasAlunos}
          niveis={niveis}
          experiencias={experiencias}
          onSave={onSaveExperiencia}
          onUpdate={onUpdateExperiencia}
          onRemove={onRemoveExperiencia}
        />
      ) : view === "desistencias" ? (
        <SecaoDesistencias
          escolas={escolas}
          turmas={turmasAlunos}
          niveis={niveis}
          motivos={options.motivosDesistencia || DEFAULT_MOTIVOS_DESISTENCIA}
          desistencias={desistencias}
          onSave={onSaveDesistencia}
          onRemove={onRemoveDesistencia}
          onGerirLista={onGerirLista}
        />
      ) : view === "desvinc" ? (
        <SecaoDesvinculacoes
          escolas={escolas}
          desvinculacoes={desvinculacoes}
          onSave={onSaveDesvinc}
          onUpdate={onUpdateDesvinc}
          onRemove={onRemoveDesvinc}
        />
      ) : view === "espacos" ? (
        <SecaoEspacos
          escolas={escolas}
          turmas={turmasAlunos}
          niveis={niveis}
          espacos={espacos}
          listaEspacos={options.espacosLista || DEFAULT_ESPACOS}
          onSave={onSaveEspaco}
          onRemove={onRemoveEspaco}
          onGerirLista={onGerirLista}
        />
      ) : view === "eventos" ? (
        <SecaoEventos escolas={escolas} eventos={eventos} onSave={onSaveEvento} onRemove={onRemoveEvento} />
      ) : view === "satisfacao" ? (
        <SecaoSatisfacao
          escolas={escolas}
          turmas={turmasAlunos}
          niveis={niveis}
          categorias={options.categoriasSatisfacao || DEFAULT_CATEGORIAS_SATISFACAO}
          satisfacao={satisfacao}
          onSave={onSaveSatisfacao}
          onRemove={onRemoveSatisfacao}
          onGerirLista={onGerirLista}
        />
      ) : view === "registo" ? (
        <InscritosRegisto
          escolas={escolas}
          inscritos={inscritos}
          turmasAlunos={turmasAlunos}
          epocaAnterior={epocaAnterior}
          options={options}
          onSaveSemana={onSaveSemana}
          onRetrato={onRetrato}
          onImportarTurmas={onImportarTurmas}
          notificar={notificar}
          onSaveTurma={onSaveTurma}
          onRemoveTurma={onRemoveTurma}
          onSaveEpocaAnterior={onSaveEpocaAnterior}
          onToggleTurmaEscola={onToggleTurmaEscola}
          onAddOption={onAddOption}
          onRemoveOption={onRemoveOption}
          onGerirLista={onGerirLista}
        />
      ) : (
        <InscritosAnalise
          escolas={escolas}
          inscritos={inscritos}
          turmasAlunos={turmasAlunos}
          epocaAnterior={epocaAnterior}
          niveis={options.niveis || DEFAULT_NIVEIS}
        />
      )}
      </div>
    </div>
  );
}

function InscritosRegisto({
  escolas,
  inscritos,
  turmasAlunos,
  epocaAnterior,
  options,
  onImportarTurmas,
  onRetrato,
  notificar,
  onSaveSemana,
  onSaveTurma,
  onRemoveTurma,
  onSaveEpocaAnterior,
  onToggleTurmaEscola,
  onAddOption,
  onRemoveOption,
}) {
  const hoje = new Date();
  const semanaAtual = (() => {
    const d = new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const inicio = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const n = Math.ceil(((d - inicio) / 86400000 + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(n).padStart(2, "0")}`;
  })();

  const turmas = options.turmas || DEFAULT_TURMAS;
  const niveis = options.niveis || DEFAULT_NIVEIS;
  const porEscola = options.turmasPorEscola || {};

  const [tEsc, setTEsc] = useState(escolas[0] || "");
  const [tTurma, setTTurma] = useState("");
  const [tAno, setTAno] = useState(String(hoje.getFullYear() - 10));
  const [tM, setTM] = useState("");
  const [tF, setTF] = useState("");
  const [erroTurma, setErroTurma] = useState("");

  const [hEsc, setHEsc] = useState(escolas[0] || "");
  const [hIns, setHIns] = useState("");
  const [hDes, setHDes] = useState("");
  const [erroH, setErroH] = useState("");

  const [importarAberto, setImportarAberto] = useState(false);
  const [gEsc, setGEsc] = useState(escolas[0] || "");
  const [novaTurma, setNovaTurma] = useState("");
  const [novoTipo, setNovoTipo] = useState("escolinha");
  const [erroG, setErroG] = useState("");

  const turmasDaEscola = porEscola[tEsc] || [];
  const anos = [];
  for (let a = hoje.getFullYear(); a >= hoje.getFullYear() - 20; a--) anos.push(String(a));

  const guardarTurma = () => {
    if ((tM === "" && tF === "") || Number(tM || 0) < 0 || Number(tF || 0) < 0) {
      setErroTurma("Introduz pelo menos um número válido de atletas.");
      return;
    }
    if (!tTurma) {
      setErroTurma("Escolhe a turma.");
      return;
    }
    setErroTurma("");
    onSaveTurma({ escola: tEsc, turma: tTurma, ano: Number(tAno), m: Math.round(Number(tM || 0)), f: Math.round(Number(tF || 0)) });
    setTM("");
    setTF("");
  };

  const guardarEpocaAnterior = () => {
    if (hIns === "" || isNaN(hIns) || Number(hIns) < 0) {
      setErroH("Introduz um número de inscritos válido.");
      return;
    }
    setErroH("");
    onSaveEpocaAnterior(hEsc, { inscritos: Math.round(Number(hIns)), desist: Math.round(Number(hDes || 0)) });
    setHIns("");
    setHDes("");
  };

  const registosSemana = escolas
    .flatMap((e) => (inscritos[e] || []).map((r) => ({ ...r, escola: e })))
    .sort((a, b) => b.semana.localeCompare(a.semana))
    .slice(0, 10);

  const th = { textAlign: "left", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", color: COLORS.slate, padding: "9px 12px", borderBottom: `1px solid ${COLORS.rule}` };
  const td = { padding: "9px 12px", borderBottom: "1px solid #EFEDE7", fontSize: 13.5 };

  return (
    <div>
      <div style={{ ...panelStyle, marginBottom: 16 }}>
        <div style={panelTitle}>Turmas e equipas por escola</div>
        <div style={{ display: "flex", gap: 26, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 240px" }}>
            <label style={{ ...labelStyle, marginTop: 0 }}>Escolas</label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
              {escolas.map((e) => (
                <span key={e} style={{ fontSize: 12, fontWeight: 600, padding: "5px 11px", borderRadius: 20, background: COLORS.rule, color: COLORS.navy }}>
                  {e}
                </span>
              ))}
            </div>
            <div style={{ fontSize: 12, color: COLORS.slate, lineHeight: 1.5 }}>
              Vêm da lista de escolas da app. Adiciona ou remove em "Escolas e listas" e aparecem aqui.
            </div>
          </div>
          <div style={{ flex: "1 1 320px" }}>
            <label style={{ ...labelStyle, marginTop: 0 }}>Turmas / escalões (lista geral)</label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
              {turmas.map((t) => (
                <TurmaChip key={t} label={t} onDelete={() => {
                  if (turmasAlunos.some((r) => r.turma === t)) {
                    setErroG(`Não dá para remover "${t}": já tem alunos registados.`);
                    return;
                  }
                  setErroG("");
                  onRemoveOption("turmas", t);
                  if (niveis.includes(t)) onRemoveOption("niveis", t);
                }} />
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="text"
                placeholder="Ex: Sub-20"
                value={novaTurma}
                onChange={(e) => {
                  setNovaTurma(e.target.value);
                  setErroG("");
                }}
                style={inputStyle}
              />
              <select value={novoTipo} onChange={(e) => setNovoTipo(e.target.value)} style={{ ...inputStyle, width: 140 }}>
                <option value="escolinha">Escolinha</option>
                <option value="competicao">Competição</option>
              </select>
              <button
                onClick={() => {
                  const v = novaTurma.trim();
                  if (!v) {
                    setErroG("Escreve o nome da turma.");
                    return;
                  }
                  if (turmas.includes(v)) {
                    setErroG("Essa turma já existe.");
                    return;
                  }
                  setErroG("");
                  onAddOption("turmas", v);
                  if (novoTipo === "escolinha") onAddOption("niveis", v);
                  setNovaTurma("");
                }}
                style={{ ...primaryBtnStyle, flex: "none", padding: "9px 14px" }}
              >
                Adicionar
              </button>
            </div>
          </div>
        </div>

        <div style={{ borderTop: `1px solid ${COLORS.rule}`, marginTop: 18, paddingTop: 14 }}>
          <label style={{ ...labelStyle, marginTop: 0 }}>Turmas existentes em cada escola</label>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
            <select value={gEsc} onChange={(e) => setGEsc(e.target.value)} style={{ ...inputStyle, width: 190 }}>
              {escolas.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
            <span style={{ fontSize: 12.5, color: COLORS.slate }}>Clica para ativar ou desativar nesta escola</span>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {turmas.map((t) => {
              const on = (porEscola[gEsc] || []).includes(t);
              return (
                <button
                  key={t}
                  onClick={() => {
                    if (on && turmasAlunos.some((r) => r.escola === gEsc && r.turma === t)) {
                      setErroG(`"${t}" tem alunos registados em ${gEsc}.`);
                      return;
                    }
                    setErroG("");
                    onToggleTurmaEscola(gEsc, t);
                  }}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 20,
                    border: `1.5px solid ${on ? COLORS.navy : COLORS.rule}`,
                    background: on ? COLORS.navy : "transparent",
                    color: on ? COLORS.onAccent : COLORS.slate,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {on ? "✓ " : "+ "}
                  {t}
                </button>
              );
            })}
          </div>
          {erroG && <div style={{ color: COLORS.danger, fontSize: 13, marginTop: 8 }}>{erroG}</div>}
        </div>
      </div>

      <div style={{ ...panelStyle, marginBottom: 16 }}>
        <div style={panelTitle}>Retrato semanal</div>
        <div style={{ fontSize: 12.5, color: COLORS.ink2, marginBottom: 14, lineHeight: 1.55 }}>
          O total de inscritos não se escreve à mão: é somado das turmas. Este botão guarda o retrato desta semana em
          todas as escolas, para depois haver histórico e curvas de crescimento na Análise.
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <button className="press" onClick={() => onRetrato(semanaAtual)} style={{ ...primaryBtnStyle, flex: "none", padding: "9px 16px" }}>
            Guardar retrato de {semanaLabel(semanaAtual)}
          </button>
          <span style={{ fontSize: 12, color: COLORS.slate }}>
            {escolas.filter((e) => (inscritos[e] || []).some((r) => r.semana === semanaAtual)).length} de {escolas.length} escolas já
            com retrato desta semana
          </span>
        </div>

        {registosSemana.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 16 }}>
            <thead>
              <tr>
                {["Semana", "Escola", "Inscritos", "Novas", "Desistências"].map((h) => (
                  <th key={h} style={th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {registosSemana.map((r) => (
                <tr key={r.escola + r.semana}>
                  <td style={{ ...td, fontVariantNumeric: "tabular-nums" }}>{semanaLabel(r.semana)}</td>
                  <td style={td}>{r.escola}</td>
                  <td style={{ ...td, fontWeight: 600 }}>{r.total}</td>
                  <td style={td}>{r.novas || 0}</td>
                  <td style={td}>{r.desist || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ ...panelStyle, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
          <div style={panelTitle}>Alunos por turma / escalão</div>
          <button className="press" onClick={() => setImportarAberto(true)} style={{ ...secondaryBtnStyle, flex: "none", padding: "7px 13px", fontSize: 12.5 }}>
            Importar de Excel / CSV
          </button>
        </div>
        <div style={{ fontSize: 12.5, color: COLORS.slate, marginBottom: 12 }}>Apenas números absolutos — nenhum dado pessoal de atletas.</div>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div>
            <label style={{ ...labelStyle, marginTop: 0 }}>Escola</label>
            <select
              value={tEsc}
              onChange={(e) => {
                setTEsc(e.target.value);
                setTTurma("");
              }}
              style={{ ...inputStyle, width: 160 }}
            >
              {escolas.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ ...labelStyle, marginTop: 0 }}>Turma / equipa</label>
            <select value={tTurma} onChange={(e) => setTTurma(e.target.value)} style={{ ...inputStyle, width: 175 }}>
              <option value="">{turmasDaEscola.length ? "Selecionar..." : "Sem turmas nesta escola"}</option>
              {turmasDaEscola.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ ...labelStyle, marginTop: 0 }}>Ano de nascimento</label>
            <select value={tAno} onChange={(e) => setTAno(e.target.value)} style={{ ...inputStyle, width: 150 }}>
              {anos.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ ...labelStyle, marginTop: 0 }}>Masculinos</label>
            <input type="number" min="0" value={tM} onChange={(e) => { setTM(e.target.value); setErroTurma(""); }} style={{ ...inputStyle, width: 110 }} placeholder="14" />
          </div>
          <div>
            <label style={{ ...labelStyle, marginTop: 0 }}>Femininos</label>
            <input type="number" min="0" value={tF} onChange={(e) => { setTF(e.target.value); setErroTurma(""); }} style={{ ...inputStyle, width: 110 }} placeholder="3" />
          </div>
          <button onClick={guardarTurma} style={{ ...primaryBtnStyle, flex: "none", padding: "9px 16px" }}>
            Registar
          </button>
        </div>
        {erroTurma && <div style={{ color: COLORS.danger, fontSize: 13, marginTop: 8 }}>{erroTurma}</div>}

        {turmasAlunos.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 16 }}>
            <thead>
              <tr>
                {["Escola", "Turma", "Ano", "M", "F", "Total", ""].map((h) => (
                  <th key={h} style={th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...turmasAlunos]
                .sort((a, b) => a.escola.localeCompare(b.escola) || a.turma.localeCompare(b.turma))
                .slice(0, 15)
                .map((r) => (
                  <tr key={r.escola + r.turma + r.ano}>
                    <td style={td}>{r.escola}</td>
                    <td style={td}>{r.turma}</td>
                    <td style={{ ...td, fontVariantNumeric: "tabular-nums" }}>{r.ano}</td>
                    <td style={td}>{r.m}</td>
                    <td style={td}>{r.f}</td>
                    <td style={{ ...td, fontWeight: 600 }}>{r.m + r.f}</td>
                    <td style={td}>
                      <button title="Remover" onClick={() => onRemoveTurma(r)} style={{ ...iconBtnStyle, padding: 0 }}>
                        <X size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              {turmasAlunos.length > 15 && (
                <tr>
                  <td colSpan={7} style={{ ...td, color: COLORS.slate, fontSize: 12 }}>
                    {turmasAlunos.length} registos no total (a mostrar 15)
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <div style={panelStyle}>
        <div style={panelTitle}>Época passada (referência)</div>
        <div style={{ fontSize: 12.5, color: COLORS.slate, marginBottom: 12 }}>
          Introduz uma vez por época. É daqui que sai a taxa de crescimento homóloga.
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div>
            <label style={{ ...labelStyle, marginTop: 0 }}>Escola</label>
            <select value={hEsc} onChange={(e) => setHEsc(e.target.value)} style={{ ...inputStyle, width: 180 }}>
              {escolas.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ ...labelStyle, marginTop: 0 }}>Inscritos no final</label>
            <input type="number" min="0" value={hIns} onChange={(e) => { setHIns(e.target.value); setErroH(""); }} style={{ ...inputStyle, width: 140 }} placeholder="112" />
          </div>
          <div>
            <label style={{ ...labelStyle, marginTop: 0 }}>Desistências na época</label>
            <input type="number" min="0" value={hDes} onChange={(e) => setHDes(e.target.value)} style={{ ...inputStyle, width: 155 }} placeholder="18" />
          </div>
          <button onClick={guardarEpocaAnterior} style={{ ...secondaryBtnStyle, flex: "none", padding: "9px 16px" }}>
            Guardar
          </button>
        </div>
        {erroH && <div style={{ color: COLORS.danger, fontSize: 13, marginTop: 8 }}>{erroH}</div>}

        {importarAberto && (
          <ImportarAlunos
            escolas={escolas}
            turmas={turmas}
            onImportar={onImportarTurmas}
            onFechar={() => setImportarAberto(false)}
            notificar={notificar}
          />
        )}

        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 16 }}>
          <thead>
            <tr>
              {["Escola", "Inscritos época passada", "Desist. passada", "Inscritos atual", "Desist. até agora", "Variação homóloga"].map((h) => (
                <th key={h} style={th}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {escolas.map((e) => {
              const serie = inscritos[e] || [];
              const atual = serie.length ? [...serie].sort((a, b) => a.semana.localeCompare(b.semana))[serie.length - 1].total : 0;
              const ant = (epocaAnterior[e] || {}).inscritos;
              const dAt = serie.reduce((t, r) => t + (r.desist || 0), 0);
              const dAnt = (epocaAnterior[e] || {}).desist;
              const v = ant ? ((atual - ant) / ant) * 100 : null;
              return (
                <tr key={e}>
                  <td style={td}>{e}</td>
                  <td style={td}>{ant ?? "—"}</td>
                  <td style={td}>{dAnt ?? "—"}</td>
                  <td style={td}>{atual || "—"}</td>
                  <td style={td}>{dAt}</td>
                  <td style={{ ...td, fontWeight: 600, color: v === null ? COLORS.slate : v >= 0 ? COLORS.ok : COLORS.danger }}>
                    {v === null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(1)}%`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function InscritosAnalise({ escolas, inscritos, turmasAlunos, epocaAnterior, niveis }) {
  const [fEsc, setFEsc] = useState("todas");
  const [periodo, setPeriodo] = useState("semana");
  const [limites, setLimites] = useState(LIMITES_CRESC_PADRAO);
  const [visible, setVisible] = useState(new Set(INSC_PARAMS.map((p) => p.key)));

  const toggle = (k) =>
    setVisible((prev) => {
      const n = new Set(prev);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });

  const todas = fEsc === "todas";
  const alvo = todas ? escolas : [fEsc];
  const series = useMemo(() => alvo.map((e) => ({ escola: e, dados: agregaSerie(inscritos[e] || [], periodo) })), [alvo, inscritos, periodo]);
  const labels = series.length ? series.reduce((best, s) => (s.dados.length > best.length ? s.dados : best), []).map((p) => p.label) : [];

  const somaPor = (campo) =>
    labels.map((_, i) => series.reduce((t, s) => t + (s.dados[i] ? s.dados[i][campo] : 0), 0));
  const totais = somaPor("total");
  const novas = somaPor("novas");
  const desist = somaPor("desist");

  const ultimo = (e) => {
    const s = inscritos[e] || [];
    if (!s.length) return 0;
    return [...s].sort((a, b) => a.semana.localeCompare(b.semana))[s.length - 1].total;
  };
  const primeiro = (e) => {
    const s = inscritos[e] || [];
    if (!s.length) return 0;
    return [...s].sort((a, b) => a.semana.localeCompare(b.semana))[0].total;
  };

  const totalAtual = alvo.reduce((t, e) => t + ultimo(e), 0);
  const ultimoPeriodo = totais.length ? totais[totais.length - 1] : 0;
  const penultimo = totais.length > 1 ? totais[totais.length - 2] : ultimoPeriodo;
  const varPeriodo = ultimoPeriodo - penultimo;
  const crescEpoca = totais.length && totais[0] ? ((ultimoPeriodo - totais[0]) / totais[0]) * 100 : 0;
  const antTotal = alvo.reduce((t, e) => t + ((epocaAnterior[e] || {}).inscritos || 0), 0);
  const homologo = antTotal ? ((totalAtual - antTotal) / antTotal) * 100 : null;

  const regT = todas ? turmasAlunos : turmasAlunos.filter((r) => r.escola === fEsc);
  const totM = regT.reduce((t, r) => t + r.m, 0);
  const totF = regT.reduce((t, r) => t + r.f, 0);
  const totEscolinha = regT.filter((r) => ehEscolinha(r.turma, niveis)).reduce((t, r) => t + r.m + r.f, 0);
  const totComp = regT.filter((r) => !ehEscolinha(r.turma, niveis)).reduce((t, r) => t + r.m + r.f, 0);

  const escaloes = useMemo(() => {
    const ordem = [...niveis, "Competição (outras)"];
    const subs = [...new Set(regT.map((r) => escalaoDaTurma(r.turma, niveis)))]
      .filter((x) => x.startsWith("Sub-"))
      .sort((a, b) => parseInt(a.slice(4)) - parseInt(b.slice(4)));
    return [...ordem, ...subs].filter((x) => regT.some((r) => escalaoDaTurma(r.turma, niveis) === x));
  }, [regT, niveis]);

  const escalaoData = escaloes.map((x) => ({
    name: x,
    M: regT.filter((r) => escalaoDaTurma(r.turma, niveis) === x).reduce((t, r) => t + r.m, 0),
    F: regT.filter((r) => escalaoDaTurma(r.turma, niveis) === x).reduce((t, r) => t + r.f, 0),
  }));
  const escolinhaData = niveis.map((n) => ({
    name: n,
    M: regT.filter((r) => escalaoDaTurma(r.turma, niveis) === n).reduce((t, r) => t + r.m, 0),
    F: regT.filter((r) => escalaoDaTurma(r.turma, niveis) === n).reduce((t, r) => t + r.f, 0),
  }));
  const generoData = [
    { name: "Masculino", value: totM, color: COLORS.progress },
    { name: "Feminino", value: totF, color: COLORS.purple },
  ];
  const anoData = [...new Set(regT.map((r) => r.ano))]
    .sort()
    .map((a) => ({ name: String(a), value: regT.filter((r) => r.ano === a).reduce((t, r) => t + r.m + r.f, 0) }));

  const evolucaoData = labels.map((l, i) => {
    const row = { name: l };
    series.forEach((s) => (row[s.escola] = s.dados[i] ? s.dados[i].total : null));
    return row;
  });
  const crescData = labels.map((l, i) => ({
    name: l,
    valor: i === 0 || !totais[i - 1] ? 0 : ((totais[i] - totais[i - 1]) / totais[i - 1]) * 100,
  }));
  const homologoData = escolas.map((e) => ({ name: e, passada: (epocaAnterior[e] || {}).inscritos || 0, atual: ultimo(e) }));
  const desistHomData = escolas.map((e) => ({
    name: e,
    passada: (epocaAnterior[e] || {}).desist || 0,
    atual: (inscritos[e] || []).reduce((t, r) => t + (r.desist || 0), 0),
  }));
  const fluxoData = labels.map((l, i) => ({ name: l, novas: novas[i], desist: -desist[i] }));

  const metrics = useMemo(
    () => ({
      inscritos: { label: "Nº de inscritos", v: (e) => ultimo(e), fmt: (v) => v },
      cresc: {
        label: "Crescimento na época (%)",
        v: (e) => (primeiro(e) ? +(((ultimo(e) - primeiro(e)) / primeiro(e)) * 100).toFixed(1) : 0),
        fmt: (v) => (v > 0 ? "+" : "") + v + "%",
      },
      homologo: {
        label: "Crescimento homólogo (%)",
        v: (e) => {
          const a = (epocaAnterior[e] || {}).inscritos;
          return a ? +(((ultimo(e) - a) / a) * 100).toFixed(1) : 0;
        },
        fmt: (v) => (v > 0 ? "+" : "") + v + "%",
      },
      desist: { label: "Desistências na época", v: (e) => (inscritos[e] || []).reduce((t, r) => t + (r.desist || 0), 0), fmt: (v) => v },
      taxadesist: {
        label: "Taxa de desistência (%)",
        v: (e) => {
          const t = ultimo(e);
          const d = (inscritos[e] || []).reduce((a, r) => a + (r.desist || 0), 0);
          return t + d ? +((d / (t + d)) * 100).toFixed(1) : 0;
        },
        fmt: (v) => v + "%",
      },
      novas: { label: "Novas inscrições", v: (e) => (inscritos[e] || []).reduce((t, r) => t + (r.novas || 0), 0), fmt: (v) => v },
      turmas: { label: "Nº de turmas", v: (e) => new Set(turmasAlunos.filter((r) => r.escola === e).map((r) => r.turma)).size, fmt: (v) => v },
      pctfem: {
        label: "% de atletas femininas",
        v: (e) => {
          const r = turmasAlunos.filter((x) => x.escola === e);
          const m = r.reduce((t, x) => t + x.m, 0);
          const f = r.reduce((t, x) => t + x.f, 0);
          return m + f ? +((f / (m + f)) * 100).toFixed(1) : 0;
        },
        fmt: (v) => v + "%",
      },
      pctescolinha: {
        label: "% em escolinha",
        v: (e) => {
          const r = turmasAlunos.filter((x) => x.escola === e);
          const t = r.reduce((a, x) => a + x.m + x.f, 0);
          const es = r.filter((x) => ehEscolinha(x.turma, niveis)).reduce((a, x) => a + x.m + x.f, 0);
          return t ? +((es / t) * 100).toFixed(1) : 0;
        },
        fmt: (v) => v + "%",
      },
    }),
    [inscritos, turmasAlunos, epocaAnterior, niveis]
  );

  const semDados = escolas.every((e) => !(inscritos[e] || []).length) && turmasAlunos.length === 0;
  const filterStyle = { ...inputStyle, width: 190 };
  const legend = (items) => (
    <div style={{ display: "flex", justifyContent: "center", gap: 14, fontSize: 11.5, marginTop: 6, flexWrap: "wrap" }}>
      {items.map(([l, c]) => (
        <div key={l} style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 9, height: 9, borderRadius: 2, background: c, display: "inline-block" }} />
          {l}
        </div>
      ))}
    </div>
  );

  if (semDados) {
    return (
      <Vazio
        icon={BarChart3}
        titulo="Ainda sem dados para analisar"
        texto="Regista pelo menos uma semana de inscritos, ou alunos por turma, no separador Registo."
      />
    );
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <select value={fEsc} onChange={(e) => setFEsc(e.target.value)} style={filterStyle}>
          <option value="todas">Todas as escolas</option>
          {escolas.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
        <select value={periodo} onChange={(e) => setPeriodo(e.target.value)} style={filterStyle}>
          <option value="semana">Vista semanal</option>
          <option value="mes">Vista mensal</option>
        </select>
      </div>

      <ParamChips params={INSC_PARAMS} visible={visible} onToggle={toggle} />

      <div style={{ display: "flex", gap: 14, marginBottom: 20, flexWrap: "wrap" }}>
        <StatCard label="Inscritos" value={totalAtual} />
        <StatCard
          label="Variação no período"
          value={`${varPeriodo > 0 ? "+" : ""}${varPeriodo}`}
          color={varPeriodo > 0 ? COLORS.ok : varPeriodo < 0 ? COLORS.danger : COLORS.navy}
          subtitle={`${penultimo ? (((varPeriodo / penultimo) * 100).toFixed(1) > 0 ? "+" : "") + ((varPeriodo / penultimo) * 100).toFixed(1) : "0"}% vs ${periodo === "semana" ? "semana" : "mês"} anterior`}
        />
        <StatCard
          label="Crescimento na época"
          value={`${crescEpoca > 0 ? "+" : ""}${crescEpoca.toFixed(1)}%`}
          color={crescEpoca > 0 ? COLORS.ok : crescEpoca < 0 ? COLORS.danger : COLORS.navy}
        />
        <StatCard
          label="Crescimento homólogo"
          value={homologo === null ? "—" : `${homologo > 0 ? "+" : ""}${homologo.toFixed(1)}%`}
          color={homologo === null ? COLORS.navy : homologo > 0 ? COLORS.ok : COLORS.danger}
          subtitle={antTotal ? `${totalAtual} vs ${antTotal} na época passada` : "sem dados da época passada"}
        />
        <StatCard
          label="Alunos de escolinha"
          value={totEscolinha}
          subtitle={totEscolinha + totComp ? `${Math.round((totEscolinha / (totEscolinha + totComp)) * 100)}% · ${totComp} em competição` : ""}
        />
      </div>

      {visible.has("classes") && (
        <div style={{ ...panelStyle, marginBottom: 16 }}>
          <div style={panelTitle}>Classificação de crescimento por escola</div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14, alignItems: "flex-end" }}>
            {[
              ["critico", "Crítico abaixo de"],
              ["declinio", "Declínio abaixo de"],
              ["estavel", "Estável até"],
            ].map(([k, l]) => (
              <div key={k}>
                <label style={{ ...labelStyle, marginTop: 0 }}>{l}</label>
                <input
                  type="number"
                  value={limites[k]}
                  onChange={(e) => setLimites((p) => ({ ...p, [k]: Number(e.target.value) }))}
                  style={{ ...inputStyle, width: 100 }}
                />
              </div>
            ))}
            <div style={{ fontSize: 12, color: COLORS.slate, paddingBottom: 10 }}>valores em % de crescimento homólogo</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 10 }}>
            {escolas.map((e) => {
              const a = (epocaAnterior[e] || {}).inscritos;
              const v = a ? ((ultimo(e) - a) / a) * 100 : null;
              const cls = v === null ? null : classificarCrescimento(v, limites);
              return (
                <div
                  key={e}
                  style={{
                    border: `1px solid ${COLORS.rule}`,
                    borderLeft: `3px solid ${cls ? cls.color : COLORS.rule}`,
                    padding: "10px 12px",
                    background: COLORS.paper,
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{e}</div>
                  <div style={{ fontSize: 20, color: cls ? cls.color : COLORS.slate, margin: "3px 0" }}>
                    {v === null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(1)}%`}
                  </div>
                  <div style={{ fontSize: 11.5, color: cls ? cls.color : COLORS.slate, fontWeight: 600 }}>
                    {cls ? cls.label : "sem época passada"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {visible.has("quad") && (
        <div style={{ marginBottom: 16 }}>
          <QuadrantMatrix
            subjects={escolas}
            metrics={metrics}
            defaultX="taxadesist"
            defaultY="homologo"
            label="Matriz de quadrantes — cruzar duas métricas de inscritos por escola"
          />
        </div>
      )}

      {visible.has("evolucao") && (
        <div style={{ ...panelStyle, marginBottom: 16 }}>
          <div style={panelTitle}>Evolução de inscritos — vista {periodo === "semana" ? "semanal" : "mensal"}</div>
          <ResponsiveContainer width="100%" height={270}>
            <LineChart data={evolucaoData}>
              <CartesianGrid stroke={COLORS.ruleSoft} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: COLORS.slate }} axisLine={{ stroke: COLORS.rule }} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: COLORS.slate }} axisLine={false} tickLine={false} width={34} />
              <Tooltip content={<DicaGrafico />} cursor={{ fill: COLORS.ruleSoft }} />
              {series.map((s, i) => (
                <Line
                  key={s.escola}
                  type="monotone"
                  dataKey={s.escola}
                  stroke={TAG_PALETTE[i % TAG_PALETTE.length].color}
                  strokeWidth={2.2}
                  dot={{ r: 3 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
          {legend(series.map((s, i) => [s.escola, TAG_PALETTE[i % TAG_PALETTE.length].color]))}
        </div>
      )}

      {visible.has("crescimento") && (
        <div style={{ ...panelStyle, marginBottom: 16 }}>
          <div style={panelTitle}>Crescimento {periodo === "semana" ? "semanal" : "mensal"} (%) — positivo e negativo</div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={crescData}>
              <CartesianGrid stroke={COLORS.ruleSoft} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: COLORS.slate }} axisLine={{ stroke: COLORS.rule }} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: COLORS.slate }} axisLine={false} tickLine={false} width={40} tickFormatter={(v) => `${v}%`} />
              <Tooltip content={<DicaGrafico sufixo="%" />} cursor={{ fill: COLORS.ruleSoft }} />
              <ReferenceLine y={0} stroke={COLORS.slate} />
              <Bar dataKey="valor" radius={[3, 3, 0, 0]}>
                {crescData.map((d, i) => (
                  <Cell key={i} fill={d.valor >= 0 ? COLORS.progress : COLORS.danger} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
        {visible.has("escalao") && (
          <div style={{ ...panelStyle, flex: "1 1 340px" }}>
            <div style={panelTitle}>Alunos por escalão</div>
            {escalaoData.length === 0 ? (
              <div style={{ fontSize: 13, color: COLORS.slate }}>Sem alunos registados por turma.</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={Math.max(200, escalaoData.length * 26)}>
                  <BarChart data={escalaoData} layout="vertical" margin={{ left: 8 }}>
                    <CartesianGrid stroke={COLORS.ruleSoft} strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: COLORS.slate }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11.5, fill: COLORS.ink }} axisLine={false} tickLine={false} />
                    <Tooltip content={<DicaGrafico />} cursor={{ fill: COLORS.ruleSoft }} />
                    <Bar dataKey="M" name="Masculino" stackId="g" fill={COLORS.progress} />
                    <Bar dataKey="F" name="Feminino" stackId="g" fill={COLORS.purple} radius={[3, 3, 0, 0]} animationDuration={800} />
                  </BarChart>
                </ResponsiveContainer>
                {legend([
                  ["Masculino", COLORS.progress],
                  ["Feminino", COLORS.purple],
                ])}
              </>
            )}
          </div>
        )}

        {visible.has("escolinha") && (
          <div style={{ ...panelStyle, flex: "1 1 340px" }}>
            <div style={panelTitle}>Escolinha, por nível</div>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={escolinhaData}>
                <CartesianGrid stroke={COLORS.ruleSoft} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: COLORS.slate }} axisLine={{ stroke: COLORS.rule }} tickLine={false} interval={0} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: COLORS.slate }} axisLine={false} tickLine={false} width={28} />
                <Tooltip content={<DicaGrafico />} cursor={{ fill: COLORS.ruleSoft }} />
                <Bar dataKey="M" name="Masculino" stackId="g" fill={COLORS.progress} />
                <Bar dataKey="F" name="Feminino" stackId="g" fill={COLORS.purple} radius={[3, 3, 0, 0]} animationDuration={800} />
              </BarChart>
            </ResponsiveContainer>
            <div style={{ textAlign: "center", fontSize: 11.5, color: COLORS.slate, marginTop: 6 }}>
              Escolinha {totEscolinha} · Competição {totComp}
            </div>
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
        {visible.has("genero") && (
          <div style={{ ...panelStyle, flex: "1 1 280px" }}>
            <div style={panelTitle}>Distribuição por género</div>
            {totM + totF === 0 ? (
              <div style={{ fontSize: 13, color: COLORS.slate }}>Sem alunos registados.</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={generoData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                      {generoData.map((d, i) => (
                        <Cell key={i} fill={d.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<DicaGrafico />} cursor={{ fill: COLORS.ruleSoft }} />
                  </PieChart>
                </ResponsiveContainer>
                {legend([
                  [`Masculino ${totM}`, COLORS.progress],
                  [`Feminino ${totF}`, COLORS.purple],
                ])}
              </>
            )}
          </div>
        )}

        {visible.has("ano") && (
          <div style={{ ...panelStyle, flex: "1 1 340px" }}>
            <div style={panelTitle}>Alunos por ano de nascimento</div>
            {anoData.length === 0 ? (
              <div style={{ fontSize: 13, color: COLORS.slate }}>Sem alunos registados.</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={anoData}>
                  <CartesianGrid stroke={COLORS.ruleSoft} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: COLORS.slate }} axisLine={{ stroke: COLORS.rule }} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: COLORS.slate }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip content={<DicaGrafico />} cursor={{ fill: COLORS.ruleSoft }} />
                  <Bar dataKey="value" fill={COLORS.navy} radius={[3, 3, 0, 0]} animationDuration={800} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {visible.has("homologo") && (
          <>
            <div style={{ ...panelStyle, flex: "1 1 340px" }}>
              <div style={panelTitle}>Inscritos: atual vs época passada</div>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={homologoData}>
                  <CartesianGrid stroke={COLORS.ruleSoft} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: COLORS.slate }} axisLine={{ stroke: COLORS.rule }} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: COLORS.slate }} axisLine={false} tickLine={false} width={34} />
                  <Tooltip content={<DicaGrafico />} cursor={{ fill: COLORS.ruleSoft }} />
                  <Bar dataKey="passada" name="Época passada" fill={COLORS.slate} radius={[3, 3, 0, 0]} animationDuration={800} />
                  <Bar dataKey="atual" name="Época atual" fill={COLORS.progress} radius={[3, 3, 0, 0]} animationDuration={800} />
                </BarChart>
              </ResponsiveContainer>
              {legend([
                ["Época passada", COLORS.slate],
                ["Época atual", COLORS.progress],
              ])}
            </div>
            <div style={{ ...panelStyle, flex: "1 1 340px" }}>
              <div style={panelTitle}>Desistências: atual vs época passada</div>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={desistHomData}>
                  <CartesianGrid stroke={COLORS.ruleSoft} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: COLORS.slate }} axisLine={{ stroke: COLORS.rule }} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: COLORS.slate }} axisLine={false} tickLine={false} width={34} />
                  <Tooltip content={<DicaGrafico />} cursor={{ fill: COLORS.ruleSoft }} />
                  <Bar dataKey="passada" name="Época passada" fill={COLORS.slate} radius={[3, 3, 0, 0]} animationDuration={800} />
                  <Bar dataKey="atual" name="Época atual" fill={COLORS.danger} radius={[3, 3, 0, 0]} animationDuration={800} />
                </BarChart>
              </ResponsiveContainer>
              {legend([
                ["Época passada", COLORS.slate],
                ["Época atual", COLORS.danger],
              ])}
            </div>
          </>
        )}

        {visible.has("fluxo") && (
          <div style={{ ...panelStyle, flex: "1 1 340px" }}>
            <div style={panelTitle}>Novas inscrições vs desistências</div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={fluxoData} stackOffset="sign">
                <CartesianGrid stroke={COLORS.ruleSoft} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: COLORS.slate }} axisLine={{ stroke: COLORS.rule }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: COLORS.slate }} axisLine={false} tickLine={false} width={34} />
                <Tooltip content={<DicaGrafico />} cursor={{ fill: COLORS.ruleSoft }} formatter={(v) => Math.abs(v)} />
                <ReferenceLine y={0} stroke={COLORS.slate} />
                <Bar dataKey="novas" name="Novas" stackId="f" fill={COLORS.ok} radius={[3, 3, 0, 0]} animationDuration={800} />
                <Bar dataKey="desist" name="Desistências" stackId="f" fill={COLORS.danger} radius={[0, 0, 3, 3]} />
              </BarChart>
            </ResponsiveContainer>
            {legend([
              ["Novas inscrições", COLORS.ok],
              ["Desistências", COLORS.danger],
            ])}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Paleta de comandos (⌘K) ----------
// Salta entre secções e procura reclamações sem tocar no rato.
// Navega-se com as setas, confirma-se com Enter e sai-se com Escape.
function PaletaComandos({ aberta, onFechar, comandos }) {
  const [busca, setBusca] = useState("");
  const [indice, setIndice] = useState(0);
  const campoRef = useRef(null);

  useEffect(() => {
    if (aberta) {
      setBusca("");
      setIndice(0);
      // Espera o painel montar antes de focar o campo.
      const id = setTimeout(() => campoRef.current && campoRef.current.focus(), 30);
      return () => clearTimeout(id);
    }
  }, [aberta]);

  const norm = (t) =>
    String(t || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

  const filtrados = useMemo(() => {
    const q = norm(busca).trim();
    if (!q) return comandos.slice(0, 12);
    const termos = q.split(/\s+/);
    return comandos
      .filter((c) => termos.every((t) => norm(`${c.titulo} ${c.grupo} ${c.detalhe || ""}`).includes(t)))
      .slice(0, 12);
  }, [busca, comandos]);

  useEffect(() => {
    setIndice(0);
  }, [busca]);

  if (!aberta) return null;

  const executar = (c) => {
    if (!c) return;
    onFechar();
    c.acao();
  };

  const teclas = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndice((i) => Math.min(i + 1, filtrados.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndice((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      executar(filtrados[indice]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onFechar();
    }
  };

  // Agrupa mantendo a ordem em que os grupos aparecem nos resultados.
  const grupos = [];
  filtrados.forEach((c) => {
    const g = grupos.find((x) => x.nome === c.grupo);
    if (g) g.itens.push(c);
    else grupos.push({ nome: c.grupo, itens: [c] });
  });

  return (
    <div
      className="veil"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(8,14,24,0.4)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        zIndex: 80,
        padding: "14vh 16px 16px",
      }}
      onClick={onFechar}
    >
      <div
        className="sheet"
        style={{
          width: "min(560px, 100%)",
          maxHeight: "calc(100vh - 20vh)",
          display: "flex",
          flexDirection: "column",
          background: COLORS.paperRaised,
          border: `1px solid ${COLORS.rule}`,
          borderRadius: 14,
          overflow: "hidden",
          boxShadow: "0 24px 60px -16px rgba(8,14,24,0.4)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 16px", borderBottom: `1px solid ${COLORS.rule}` }}>
          <Search size={16} color={COLORS.slate} />
          <input
            ref={campoRef}
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            onKeyDown={teclas}
            placeholder="Ir para uma secção ou procurar uma reclamação..."
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              background: "transparent",
              fontSize: 14.5,
              color: COLORS.ink,
              padding: 0,
            }}
          />
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: COLORS.slate,
              border: `1px solid ${COLORS.rule}`,
              borderRadius: 5,
              padding: "2px 6px",
            }}
          >
            esc
          </span>
        </div>

        <div style={{ overflowY: "auto", padding: 6 }}>
          {filtrados.length === 0 ? (
            <div style={{ padding: "28px 16px", textAlign: "center", fontSize: 13, color: COLORS.slate }}>
              Nada encontrado para "{busca}".
            </div>
          ) : (
            grupos.map((g) => (
              <div key={g.nome}>
                <div style={{ padding: "8px 10px 4px", fontSize: 11, fontWeight: 600, color: COLORS.slate }}>{g.nome}</div>
                {g.itens.map((c) => {
                  const i = filtrados.indexOf(c);
                  const activo = i === indice;
                  const Icone = c.icon;
                  return (
                    <button
                      key={c.id}
                      onMouseEnter={() => setIndice(i)}
                      onClick={() => executar(c)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        width: "100%",
                        textAlign: "left",
                        border: "none",
                        borderRadius: 8,
                        padding: "9px 10px",
                        background: activo ? COLORS.navyWash : "transparent",
                        color: activo ? COLORS.navySoft : COLORS.ink,
                        cursor: "pointer",
                        fontSize: 13.5,
                        fontWeight: 500,
                      }}
                    >
                      {Icone && <Icone size={15} />}
                      <span style={{ flex: 1 }}>{c.titulo}</span>
                      {c.detalhe && (
                        <span style={{ fontSize: 11.5, color: activo ? COLORS.navySoft : COLORS.slate, fontVariantNumeric: "tabular-nums" }}>
                          {c.detalhe}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div
          style={{
            display: "flex",
            gap: 14,
            padding: "9px 16px",
            borderTop: `1px solid ${COLORS.rule}`,
            fontSize: 11.5,
            color: COLORS.slate,
            background: COLORS.paperSunken,
          }}
        >
          <span>↑↓ navegar</span>
          <span>↵ abrir</span>
          <span style={{ marginLeft: "auto" }}>{filtrados.length} resultado(s)</span>
        </div>
      </div>
    </div>
  );
}

// ---------- Main App ----------
export default function App() {
  const [entries, setEntries] = useState([]);
  const [options, setOptions] = useState({ schools: [], categories: [], auditCategories: [], complaintCategories: DEFAULT_CATEGORIAS, sanctionTypes: DEFAULT_TIPOS_SANCAO, auditAreas: DEFAULT_AREAS_AUDITORIA, turmas: DEFAULT_TURMAS, niveis: DEFAULT_NIVEIS, turmasPorEscola: {}, motivosDesistencia: DEFAULT_MOTIVOS_DESISTENCIA, categoriasSatisfacao: DEFAULT_CATEGORIAS_SATISFACAO, espacosLista: DEFAULT_ESPACOS });
  const [audits, setAudits] = useState([]);
  const [sanctions, setSanctions] = useState([]);
  const [learned, setLearned] = useState({ canal: {}, categoria: {}, tema: {}, gravidade: {} });
  const [inscritos, setInscritos] = useState({});
  const [turmasAlunos, setTurmasAlunos] = useState([]);
  const [epocaAnterior, setEpocaAnterior] = useState({});
  const [desistencias, setDesistencias] = useState([]);
  const [experiencias, setExperiencias] = useState([]);
  const [desvinculacoes, setDesvinculacoes] = useState([]);
  const [espacos, setEspacos] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [satisfacao, setSatisfacao] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showAuditForm, setShowAuditForm] = useState(false);
  const [viewingAudit, setViewingAudit] = useState(null);
  const [viewingDetail, setViewingDetail] = useState(null);
  const [showSanctionForm, setShowSanctionForm] = useState(false);
  const [viewingSanction, setViewingSanction] = useState(null);
  const [page, setPage] = useState("registo");
  // Tema claro/escuro. Fica guardado no browser para não se perder ao recarregar.
  // Notificações flutuantes: substituem o banner de erro, que só aparecia
  // numa das páginas e passava despercebido nas outras.
  const [paletaAberta, setPaletaAberta] = useState(false);
  // Qual lista está a ser gerida: cada campo abre só a sua, em vez de um
  // único menu com todas as listas da app.
  const [listaAberta, setListaAberta] = useState(null);
  const [notificacoes, setNotificacoes] = useState([]);
  const notificar = useCallback((texto, tipo = "ok", duracao = 4200) => {
    const id = `n_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    setNotificacoes((l) => [...l, { id, texto, tipo }]);
    if (duracao) setTimeout(() => setNotificacoes((l) => l.filter((n) => n.id !== id)), duracao);
  }, []);
  const fecharNotificacao = (id) => setNotificacoes((l) => l.filter((n) => n.id !== id));

  const [tema, setTemaState] = useState(() => {
    try {
      return window.localStorage.getItem("df-tema") === "dark" ? "dark" : "light";
    } catch (e) {
      return "light";
    }
  });
  const setTema = (t) => {
    setTemaState(t);
    try {
      window.localStorage.setItem("df-tema", t);
    } catch (e) {
      // sem localStorage disponível: o tema só vale nesta sessão
    }
  };
  // Aplica as cores antes de qualquer componente renderizar neste ciclo.
  aplicarTema(tema);

  // ⌘K (ou Ctrl+K) abre a paleta de comandos em qualquer página.
  useEffect(() => {
    const aoTeclar = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletaAberta((v) => !v);
      }
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, []);
  const [reclamacoesView, setReclamacoesView] = useState("registo");
  const [editing, setEditing] = useState(null);
  const [filterCanal, setFilterCanal] = useState("todos");
  const [filterEpoca, setFilterEpoca] = useState("todas");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [search, setSearch] = useState("");

  const persist = useCallback(async (next) => {
    setEntries(next);
    try {
      await dbStorage.set(STORAGE_KEY, JSON.stringify(next));
    } catch (e) {
      console.error("Erro ao guardar reclamações:", e);
      notificar(`Não foi possível guardar as reclamações: ${e?.message || e}`, "erro", 0);
    }
  }, []);

  const persistOptions = useCallback(async (next) => {
    setOptions(next);
    try {
      await dbStorage.set(STORAGE_OPTIONS_KEY, JSON.stringify(next));
    } catch (e) {
      console.error("Erro ao guardar listas:", e);
      notificar(`Não foi possível guardar as listas: ${e?.message || e}`, "erro", 0);
    }
  }, []);

  const persistAudits = useCallback(async (next) => {
    setAudits(next);
    try {
      await dbStorage.set(STORAGE_AUDITS_KEY, JSON.stringify(next));
    } catch (e) {
      console.error("Erro ao guardar auditorias:", e);
      notificar(`Não foi possível guardar as auditorias: ${e?.message || e}`, "erro", 0);
    }
  }, []);

  const persistSanctions = useCallback(async (next) => {
    setSanctions(next);
    try {
      await dbStorage.set(STORAGE_SANCOES_KEY, JSON.stringify(next));
    } catch (e) {
      console.error("Erro ao guardar sanções:", e);
      notificar(`Não foi possível guardar as sanções: ${e?.message || e}`, "erro", 0);
    }
  }, []);

  // Gravação das listas simples da gestão. Função normal (não hook) para não
  // violar as regras dos hooks ao ser usada várias vezes.
  const fazPersist = (setter, chave, nome) => async (next) => {
    setter(next);
    try {
      await dbStorage.set(chave, JSON.stringify(next));
    } catch (e) {
      console.error(`Erro ao guardar ${nome}:`, e);
      notificar(`Não foi possível guardar ${nome}: ${e?.message || e}`, "erro", 0);
    }
  };

  const persistDesistencias = fazPersist(setDesistencias, STORAGE_DESISTENCIAS_KEY, "as desistências");
  const persistExperiencias = fazPersist(setExperiencias, STORAGE_EXPERIENCIAS_KEY, "as experiências");
  const persistDesvinc = fazPersist(setDesvinculacoes, STORAGE_DESVINC_KEY, "as desvinculações");
  const persistEspacos = fazPersist(setEspacos, STORAGE_ESPACOS_KEY, "os espaços");
  const persistEventos = fazPersist(setEventos, STORAGE_EVENTOS_KEY, "os eventos");
  const persistSatisfacao = fazPersist(setSatisfacao, STORAGE_SATISFACAO_KEY, "a satisfação");

  const persistInscritos = useCallback(async (next) => {
    setInscritos(next);
    try {
      await dbStorage.set(STORAGE_INSCRITOS_KEY, JSON.stringify(next));
    } catch (e) {
      console.error("Erro ao guardar inscritos:", e);
      notificar(`Não foi possível guardar os inscritos: ${e?.message || e}`, "erro", 0);
    }
  }, []);

  const persistTurmas = useCallback(async (next) => {
    setTurmasAlunos(next);
    try {
      await dbStorage.set(STORAGE_TURMAS_KEY, JSON.stringify(next));
    } catch (e) {
      console.error("Erro ao guardar turmas:", e);
      notificar(`Não foi possível guardar as turmas: ${e?.message || e}`, "erro", 0);
    }
  }, []);

  const persistEpocaAnterior = useCallback(async (next) => {
    setEpocaAnterior(next);
    try {
      await dbStorage.set(STORAGE_EPOCA_ANT_KEY, JSON.stringify(next));
    } catch (e) {
      console.error("Erro ao guardar época anterior:", e);
      notificar(`Não foi possível guardar a época anterior: ${e?.message || e}`, "erro", 0);
    }
  }, []);

  const persistLearned = useCallback(async (next) => {
    setLearned(next);
    try {
      await dbStorage.set(STORAGE_TRIAGEM_KEY, JSON.stringify(next));
    } catch (e) {
      // falha silenciosa — não é crítico, a triagem só fica sem aprender desta vez
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await dbStorage.get(STORAGE_KEY);
        if (res && res.value) setEntries(JSON.parse(res.value));
      } catch (e) {
        // chave ainda não existe — arranque limpo
      }
      try {
        const res = await dbStorage.get(STORAGE_OPTIONS_KEY);
        if (res && res.value) setOptions({ schools: [], categories: [], auditCategories: [], complaintCategories: DEFAULT_CATEGORIAS, sanctionTypes: DEFAULT_TIPOS_SANCAO, auditAreas: DEFAULT_AREAS_AUDITORIA, turmas: DEFAULT_TURMAS, niveis: DEFAULT_NIVEIS, turmasPorEscola: {}, motivosDesistencia: DEFAULT_MOTIVOS_DESISTENCIA, categoriasSatisfacao: DEFAULT_CATEGORIAS_SATISFACAO, espacosLista: DEFAULT_ESPACOS, ...JSON.parse(res.value) });
      } catch (e) {
        // chave ainda não existe — arranque limpo
      }
      try {
        const res = await dbStorage.get(STORAGE_AUDITS_KEY);
        if (res && res.value) setAudits(JSON.parse(res.value));
      } catch (e) {
        // chave ainda não existe — arranque limpo
      }
      try {
        const res = await dbStorage.get(STORAGE_SANCOES_KEY);
        if (res && res.value) setSanctions(JSON.parse(res.value));
      } catch (e) {
        // chave ainda não existe — arranque limpo
      }
      try {
        const res = await dbStorage.get(STORAGE_INSCRITOS_KEY);
        if (res && res.value) setInscritos(JSON.parse(res.value));
      } catch (e) {
        // chave ainda não existe — arranque limpo
      }
      try {
        const res = await dbStorage.get(STORAGE_TURMAS_KEY);
        if (res && res.value) setTurmasAlunos(JSON.parse(res.value));
      } catch (e) {
        // chave ainda não existe — arranque limpo
      }
      try {
        const res = await dbStorage.get(STORAGE_EPOCA_ANT_KEY);
        if (res && res.value) setEpocaAnterior(JSON.parse(res.value));
      } catch (e) {
        // chave ainda não existe — arranque limpo
      }
      for (const [chave, setter] of [
        [STORAGE_DESISTENCIAS_KEY, setDesistencias],
        [STORAGE_EXPERIENCIAS_KEY, setExperiencias],
        [STORAGE_DESVINC_KEY, setDesvinculacoes],
        [STORAGE_ESPACOS_KEY, setEspacos],
        [STORAGE_EVENTOS_KEY, setEventos],
        [STORAGE_SATISFACAO_KEY, setSatisfacao],
      ]) {
        try {
          const r = await dbStorage.get(chave);
          if (r && r.value) setter(JSON.parse(r.value));
        } catch (e) {
          // chave ainda não existe — arranque limpo
        }
      }
      try {
        const res = await dbStorage.get(STORAGE_TRIAGEM_KEY);
        if (res && res.value) setLearned({ canal: {}, categoria: {}, tema: {}, gravidade: {}, ...JSON.parse(res.value) });
      } catch (e) {
        // chave ainda não existe — arranque limpo, aprende a partir de agora
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const addOption = (kind, value) => {
    const lista = options[kind] || [];
    if (lista.includes(value)) return;
    persistOptions({ ...options, [kind]: [...lista, value] });
  };

  const removeOption = (kind, value) => {
    const lista = options[kind] || [];
    persistOptions({ ...options, [kind]: lista.filter((v) => v !== value) });
  };

  const addAudit = (audit) => {
    persistAudits([...audits, audit]);
    setShowAuditForm(false);
  };

  const removeAudit = (auditId) => {
    persistAudits(audits.filter((a) => a.id !== auditId));
    setViewingAudit(null);
  };

  const addFinding = (auditId, finding) => {
    const next = audits.map((a) => (a.id === auditId ? { ...a, findings: [...a.findings, finding] } : a));
    persistAudits(next);
    setViewingAudit(next.find((a) => a.id === auditId));
  };

  const updateFinding = (auditId, findingId, patch) => {
    const next = audits.map((a) =>
      a.id === auditId ? { ...a, findings: a.findings.map((f) => (f.id === findingId ? { ...f, ...patch } : f)) } : a
    );
    persistAudits(next);
    setViewingAudit(next.find((a) => a.id === auditId));
  };

  const removeFinding = (auditId, findingId) => {
    const next = audits.map((a) => (a.id === auditId ? { ...a, findings: a.findings.filter((f) => f.id !== findingId) } : a));
    persistAudits(next);
    setViewingAudit(next.find((a) => a.id === auditId));
  };

  const addNote = (entryId, text) => {
    const next = entries.map((e) =>
      e.id === entryId ? { ...e, notes: [...(e.notes || []), { id: `n_${Date.now()}`, text, date: new Date().toISOString() }] } : e
    );
    persist(next);
    setViewingDetail(next.find((e) => e.id === entryId));
  };

  const saveSanction = (sanction) => {
    const exists = sanctions.some((s) => s.id === sanction.id);
    const next = exists ? sanctions.map((s) => (s.id === sanction.id ? sanction : s)) : [...sanctions, sanction];
    persistSanctions(next);
    setShowSanctionForm(false);
  };

  const removeSanction = (id) => {
    persistSanctions(sanctions.filter((s) => s.id !== id));
    setViewingSanction(null);
  };

  const updateSanction = (id, patch) => {
    const next = sanctions.map((s) => (s.id === id ? { ...s, ...patch } : s));
    persistSanctions(next);
    setViewingSanction(next.find((s) => s.id === id));
  };

  const addSanctionNote = (id, text) => {
    const next = sanctions.map((s) =>
      s.id === id ? { ...s, notes: [...(s.notes || []), { id: `n_${Date.now()}`, text, date: new Date().toISOString() }] } : s
    );
    persistSanctions(next);
    setViewingSanction(next.find((s) => s.id === id));
  };

  const saveSemanaInscritos = (escola, semana, dados) => {
    const lista = inscritos[escola] || [];
    const existe = lista.some((r) => r.semana === semana);
    const nova = existe ? lista.map((r) => (r.semana === semana ? { ...r, ...dados, semana } : r)) : [...lista, { semana, ...dados }];
    persistInscritos({ ...inscritos, [escola]: nova });
  };

  // Retrato semanal: os totais vêm das turmas, as desistências dos registos
  // dessa semana e as novas inscrições das experiências convertidas. Nada é
  // escrito à mão, para não haver dois sítios a dizer coisas diferentes.
  const guardarRetrato = (semana) => {
    const [ano, sem] = String(semana).split("-W");
    const inicio = new Date(Date.UTC(+ano, 0, 4));
    inicio.setUTCDate(inicio.getUTCDate() - ((inicio.getUTCDay() + 6) % 7) + (+sem - 1) * 7);
    const fim = new Date(inicio);
    fim.setUTCDate(fim.getUTCDate() + 6);
    const naSemana = (d) => {
      if (!d) return false;
      const x = new Date(d + "T00:00:00Z");
      return x >= inicio && x <= fim;
    };

    // Constrói o estado completo e grava uma única vez: gravar escola a escola
    // partiria sempre do estado antigo e só a última sobreviveria.
    const proximo = { ...inscritos };
    let guardadas = 0;
    (options.schools || []).forEach((escola) => {
      const doEscola = turmasAlunos.filter((t) => t.escola === escola);
      if (doEscola.length === 0) return;
      const total = doEscola.reduce((n, t) => n + t.m + t.f, 0);
      const desist = desistencias.filter((d) => d.escola === escola && naSemana(d.data)).reduce((n, d) => n + d.n, 0);
      const novas = experiencias
        .filter((x) => x.escola === escola && x.resultado === "sucesso" && naSemana(x.data))
        .reduce((n, x) => n + (x.entraram || x.n), 0);
      const lista = proximo[escola] || [];
      const existe = lista.some((r) => r.semana === semana);
      proximo[escola] = existe
        ? lista.map((r) => (r.semana === semana ? { ...r, semana, total, novas, desist } : r))
        : [...lista, { semana, total, novas, desist }];
      guardadas += 1;
    });

    if (guardadas === 0) {
      notificar("Não há turmas com alunos registados para fazer o retrato.", "aviso");
      return;
    }
    persistInscritos(proximo);
    notificar(`Retrato guardado para ${guardadas} escola(s).`);
  };

  const importarTurmas = (linhas) => {
    let atual = [...turmasAlunos];
    linhas.forEach((reg) => {
      const i = atual.findIndex((r) => r.escola === reg.escola && r.turma === reg.turma && r.ano === reg.ano);
      if (i >= 0) atual[i] = reg;
      else atual.push(reg);
    });
    persistTurmas(atual);
  };

  const saveTurmaAlunos = (registo) => {
    const i = turmasAlunos.findIndex((r) => r.escola === registo.escola && r.turma === registo.turma && r.ano === registo.ano);
    const next = i >= 0 ? turmasAlunos.map((r, k) => (k === i ? registo : r)) : [...turmasAlunos, registo];
    persistTurmas(next);
  };

  const removeTurmaAlunos = (registo) => {
    persistTurmas(turmasAlunos.filter((r) => !(r.escola === registo.escola && r.turma === registo.turma && r.ano === registo.ano)));
  };

  const saveEpocaAnterior = (escola, dados) => {
    persistEpocaAnterior({ ...epocaAnterior, [escola]: { ...(epocaAnterior[escola] || {}), ...dados } });
  };

  const toggleTurmaEscola = (escola, turma) => {
    const mapa = options.turmasPorEscola || {};
    const atual = mapa[escola] || [];
    const nova = atual.includes(turma) ? atual.filter((t) => t !== turma) : [...atual, turma];
    persistOptions({ ...options, turmasPorEscola: { ...mapa, [escola]: nova } });
  };

  // Desistência desconta da turma: tira primeiro das femininas e o resto das
  // masculinas, porque não guardamos o género de quem saiu.
  const saveDesistencia = (reg) => {
    persistDesistencias([...desistencias, reg]);
    const t = turmasAlunos.find((x) => x.escola === reg.escola && x.turma === reg.turma);
    if (t) {
      let resta = Math.min(reg.n, t.m + t.f);
      const tiraF = Math.min(t.f, resta);
      resta -= tiraF;
      saveTurmaAlunos({ ...t, f: t.f - tiraF, m: Math.max(0, t.m - resta) });
    }
  };
  const removeDesistencia = (id) => persistDesistencias(desistencias.filter((d) => d.id !== id));

  // Experiência convertida soma à turma, respeitando a capacidade.
  const updateExperiencia = (id, resultado) => {
    const x = experiencias.find((e) => e.id === id);
    if (!x) return;
    const t = turmasAlunos.find((y) => y.escola === x.escola && y.turma === x.turma);
    let entraram = x.entraram || 0;
    let aviso = null;

    if (resultado === "sucesso" && x.resultado !== "sucesso" && t) {
      const cap = t.cap || capacidadeSugerida(t.turma, options.niveis);
      const vagas = Math.max(0, cap - (t.m + t.f));
      entraram = Math.min(x.n, vagas);
      if (entraram > 0) saveTurmaAlunos({ ...t, m: t.m + entraram });
      if (entraram < x.n) {
        aviso = `A turma ${t.turma} tinha ${vagas} vaga(s): entraram ${entraram} de ${x.n}. Ajusta a capacidade se for preciso.`;
      }
    }
    if (x.resultado === "sucesso" && resultado !== "sucesso" && t && x.entraram) {
      saveTurmaAlunos({ ...t, m: Math.max(0, t.m - x.entraram) });
      entraram = 0;
    }
    persistExperiencias(experiencias.map((e) => (e.id === id ? { ...e, resultado, entraram } : e)));
    return aviso;
  };
  const saveExperiencia = (reg) => persistExperiencias([...experiencias, reg]);
  const removeExperiencia = (id) => persistExperiencias(experiencias.filter((e) => e.id !== id));

  const saveDesvinc = (reg) => persistDesvinc([...desvinculacoes, reg]);
  const updateDesvinc = (id, patch) =>
    persistDesvinc(
      desvinculacoes.map((v) => {
        if (v.id !== id) return v;
        const nv = { ...v, ...patch };
        if (nv.aceite !== true) nv.cedida = false;
        return nv;
      })
    );
  const removeDesvinc = (id) => persistDesvinc(desvinculacoes.filter((v) => v.id !== id));

  const saveEspaco = (reg) => persistEspacos([...espacos, reg]);
  const removeEspaco = (id) => persistEspacos(espacos.filter((s2) => s2.id !== id));

  const saveEvento = (reg) => persistEventos([...eventos, reg]);
  const removeEvento = (id) => persistEventos(eventos.filter((e) => e.id !== id));

  const saveSatisfacao = (reg) => persistSatisfacao([...satisfacao, reg]);
  const removeSatisfacao = (id) => persistSatisfacao(satisfacao.filter((x) => x.id !== id));

  const nextNumber = entries.length ? Math.max(...entries.map((e) => e.entryNumber)) + 1 : 1;

  const withStatus = entries.map((e) => ({ ...e, derivedStatus: deriveStatus(e) }));

  const filtered = withStatus
    .filter((e) => (filterCanal === "todos" ? true : e.canal === filterCanal))
    .filter((e) => (filterEpoca === "todas" ? true : e.epoca === filterEpoca))
    .filter((e) => (filterStatus === "todos" ? true : e.derivedStatus === filterStatus))
    .filter((e) => (search ? (e.complainant + e.description).toLowerCase().includes(search.toLowerCase()) : true))
    .sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

  const stats = {
    porPegar: withStatus.filter((e) => e.derivedStatus === "por_pegar").length,
    emAndamento: withStatus.filter((e) => e.derivedStatus === "em_andamento").length,
    atrasadas: withStatus.filter((e) => e.derivedStatus === "atrasado").length,
    concluidas: withStatus.filter((e) => e.derivedStatus === "concluido").length,
  };

  const handleSave = (item) => {
    const exists = entries.some((e) => e.id === item.id);
    const next = exists ? entries.map((e) => (e.id === item.id ? item : e)) : [...entries, item];
    persist(next);
    persistLearned(learnFromEntry(learned, item));
    setShowForm(false);
    setEditing(null);
    notificar(exists ? "Reclamação atualizada." : `Reclamação nº ${String(item.entryNumber).padStart(4, "0")} registada.`);
  };

  const startWork = (id) => {
    persist(
      entries.map((e) => (e.id === id ? { ...e, status: "em_andamento", startedDate: e.startedDate || new Date().toISOString() } : e))
    );
  };

  const markDone = (id, { responseText, eficacia, resolvedDate, startedDate } = {}) => {
    persist(
      entries.map((e) => {
        if (e.id !== id) return e;
        // Data escolhida no formulário (yyyy-mm-dd) ou, se não vier, o momento atual.
        const resolvedISO = resolvedDate ? new Date(resolvedDate + "T12:00:00").toISOString() : new Date().toISOString();
        // Data de início: usa a que vier do formulário (mesmo que seja para
        // apagar, passando null); se não vier nada no argumento, mantém a que
        // já existia. Sem data de início, a Análise exclui esta reclamação do
        // "Tempo médio de resposta" — o "Tempo médio de resolução" usa sempre
        // a data de conclusão, essa nunca fica em falta.
        const startedISO = startedDate === undefined ? e.startedDate || null : startedDate ? new Date(startedDate + "T12:00:00").toISOString() : null;
        return {
          ...e,
          status: "concluido",
          resolvedDate: resolvedISO,
          startedDate: startedISO,
          responseText: responseText !== undefined ? responseText : e.responseText || "",
          eficacia: eficacia !== undefined ? eficacia : e.eficacia || "",
        };
      })
    );
  };

  const reopen = (id) => {
    persist(entries.map((e) => (e.id === id ? { ...e, status: "em_andamento", resolvedDate: null } : e)));
  };

  const remove = (id) => {
    persist(entries.filter((e) => e.id !== id));
  };

  const titulo =
    page === "auditorias"
      ? "Auditorias"
      : page === "sancoes"
      ? "Sanções"
      : page === "inscritos"
      ? "Gestão de inscritos"
      : "Reclamações";

  // Catálogo das listas geríveis: título, onde vivem e onde são usadas.
  const LISTAS = {
    schools: {
      titulo: "Escolas",
      nota: "As escolas são partilhadas por toda a app: reclamações, auditorias, sanções e inscritos.",
      placeholder: "Ex: Dragon Force Gondomar",
      emUso: (x) =>
        entries.filter((e) => e.school === x).length +
        audits.filter((a) => a.school === x).length +
        turmasAlunos.filter((t) => t.escola === x).length,
    },
    categories: {
      titulo: "Temas de reclamação",
      nota: "Mais específicos que a categoria. Ex: comportamento de treinador, mensalidades, balneários.",
      placeholder: "Ex: Convocatórias",
      emUso: (x) => entries.filter((e) => e.tema === x).length,
    },
    complaintCategories: {
      titulo: "Categorias de reclamação",
      nota: "O agrupamento geral: disciplinar, técnico, infraestrutura e o que mais precisares.",
      placeholder: "Ex: Administrativo",
      emUso: (x) => entries.filter((e) => e.categoria === x).length,
    },
    auditAreas: {
      titulo: "Áreas e departamentos",
      nota: "Usadas nas constatações das auditorias, para saber onde se concentram os problemas.",
      placeholder: "Ex: Técnica",
      emUso: (x) => audits.reduce((n, a) => n + (a.findings || []).filter((f) => f.area === x).length, 0),
    },
    auditCategories: {
      titulo: "Categorias de constatação",
      nota: "O tipo de constatação encontrada em auditoria. Ex: documentação, equipamento, registos.",
      placeholder: "Ex: Documentação",
      emUso: (x) => audits.reduce((n, a) => n + (a.findings || []).filter((f) => f.category === x).length, 0),
    },
    sanctionTypes: {
      titulo: "Tipos de sanção",
      nota: "Aplicáveis a pais e encarregados de educação.",
      placeholder: "Ex: Suspensão por 3 jogos",
      emUso: (x) => sanctions.filter((v) => v.sanctionType === x).length,
    },
    motivosDesistencia: {
      titulo: "Motivos de desistência",
      nota: "Lista fechada, para as estatísticas serem comparáveis. Não escrevas nomes de atletas.",
      placeholder: "Ex: Mudança de escola",
      emUso: (x) => desistencias.filter((d) => d.motivo === x).length,
    },
    categoriasSatisfacao: {
      titulo: "Categorias do inquérito de satisfação",
      nota: "As dimensões que perguntas no inquérito. Cada uma recebe uma percentagem.",
      placeholder: "Ex: Comunicação",
      emUso: (x) => satisfacao.filter((sa) => (sa.valores || {})[x] !== undefined).length,
    },
    espacosLista: {
      titulo: "Espaços de treino",
      nota: "Campos, meios-campos e pavilhões usados no mapa de ocupação.",
      placeholder: "Ex: Campo 3",
      emUso: (x) => espacos.filter((sp) => sp.espaco === x).length,
    },
    turmas: {
      titulo: "Turmas e equipas",
      nota: 'As que começam por "Sub" contam como competição; as restantes como escolinha.',
      placeholder: "Ex: Sub-20",
      emUso: (x) => turmasAlunos.filter((t) => t.turma === x).length,
    },
  };

  // Comandos da paleta: secções, ações e as reclamações abertas.
  const comandosPaleta = [
    { id: "p-registo", grupo: "Ir para", titulo: "Reclamações", icon: LayoutGrid, acao: () => setPage("registo") },
    { id: "p-auditorias", grupo: "Ir para", titulo: "Auditorias", icon: ClipboardList, acao: () => setPage("auditorias") },
    { id: "p-sancoes", grupo: "Ir para", titulo: "Sanções", icon: Scale, acao: () => setPage("sancoes") },
    { id: "p-inscritos", grupo: "Ir para", titulo: "Inscritos", icon: Users, acao: () => setPage("inscritos") },
    {
      id: "a-nova",
      grupo: "Ações",
      titulo: "Nova reclamação",
      icon: Plus,
      acao: () => {
        setPage("registo");
        setReclamacoesView("registo");
        setEditing(null);
        setShowForm(true);
      },
    },
    { id: "a-auditoria", grupo: "Ações", titulo: "Nova auditoria", icon: Plus, acao: () => { setPage("auditorias"); setShowAuditForm(true); } },
    { id: "a-ocorrencia", grupo: "Ações", titulo: "Nova ocorrência disciplinar", icon: Plus, acao: () => { setPage("sancoes"); setShowSanctionForm(true); } },
    { id: "a-listas", grupo: "Ações", titulo: "Escolas e listas", icon: ShieldAlert, acao: () => setShowManage(true) },
    { id: "a-analise", grupo: "Ações", titulo: "Análise de reclamações", icon: BarChart3, acao: () => { setPage("registo"); setReclamacoesView("analise"); } },
    {
      id: "a-tema",
      grupo: "Ações",
      titulo: tema === "dark" ? "Mudar para tema claro" : "Mudar para tema escuro",
      icon: Sparkles,
      acao: () => setTema(tema === "dark" ? "light" : "dark"),
    },
    ...withStatus
      .filter((e) => e.derivedStatus !== "concluido")
      .slice(0, 30)
      .map((e) => ({
        id: `r-${e.id}`,
        grupo: "Reclamações abertas",
        titulo: `Nº ${String(e.entryNumber).padStart(4, "0")} · ${e.complainant}`,
        detalhe: [e.school, e.tema].filter(Boolean).join(" · "),
        icon: Inbox,
        acao: () => {
          setPage("registo");
          setReclamacoesView("registo");
          setViewingDetail(e);
        },
      })),
  ];

  const secoes = [
    {
      grupo: "Gestão",
      itens: [
        { key: "registo", label: "Reclamações", icon: LayoutGrid, contador: withStatus.filter((e) => e.derivedStatus !== "concluido").length },
        { key: "auditorias", label: "Auditorias", icon: ClipboardList, contador: audits.length || null },
        { key: "sancoes", label: "Sanções", icon: Scale, contador: sanctions.length || null },
        { key: "inscritos", label: "Inscritos", icon: Users, contador: null },
      ],
    },
  ];

  return (
    <div
      style={{
        fontFamily: "'Inter', system-ui, sans-serif",
        background: COLORS.paper,
        minHeight: "100vh",
        color: COLORS.ink,
        display: "flex",
        WebkitFontSmoothing: "antialiased",
      }}
    >
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;450;500;600;700&display=swap');
        .spin { animation: spin 0.9s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .navItem:hover { background: ${COLORS.paperSunken}; }
        .rowHover:hover { background: ${COLORS.paperSunken}; }
        select, input, textarea, button { font-family: inherit; }
        ::placeholder { color: ${COLORS.slate}; }

        /* ---- transições suaves, ao estilo iOS ---- */
        /* Curva de saída do iOS: arranca depressa e assenta devagar. */
        :root { --ease: cubic-bezier(0.32, 0.72, 0, 1); }

        .navItem, button, select, input, textarea { transition: background 140ms ease, border-color 140ms ease, color 140ms ease, opacity 140ms ease; }
        .navItem:active, .btnPress:active { transform: scale(0.975); }

        /* Conteúdo da página: entra com um fade curto e um deslize mínimo. */
        @keyframes pageIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        .pageIn { animation: pageIn 260ms var(--ease) both; }

        /* Fundo escurecido dos modais. */
        @keyframes veilIn { from { opacity: 0; } to { opacity: 1; } }
        .veil { animation: veilIn 200ms ease both; }

        /* Caixa centrada: sobe e cresce ligeiramente, como uma folha do iOS. */
        @keyframes sheetIn { from { opacity: 0; transform: translateY(14px) scale(0.975); } to { opacity: 1; transform: none; } }
        .sheet { animation: sheetIn 300ms var(--ease) both; }

        /* Painel lateral: desliza da direita. */
        @keyframes drawerIn { from { transform: translateX(100%); } to { transform: none; } }
        .drawer { animation: drawerIn 320ms var(--ease) both; }

        /* Linhas de tabela e cartões que aparecem depois de filtrar. */
        @keyframes softIn { from { opacity: 0; } to { opacity: 1; } }
        .softIn { animation: softIn 200ms ease both; }

        /* Respeita quem desativou animações no sistema. */
        @media (prefers-reduced-motion: reduce) {
          .pageIn, .veil, .sheet, .drawer, .softIn { animation: none; }
          .navItem, button, select, input, textarea { transition: none; }
          .navItem:active, .btnPress:active { transform: none; }
        }

        /* Nada deve sair do ecrã: barras de deslocamento discretas dentro dos painéis. */
        ::-webkit-scrollbar { width: 10px; height: 10px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${COLORS.rule}; border-radius: 6px; border: 3px solid transparent; background-clip: content-box; }
        ::-webkit-scrollbar-thumb:hover { background: ${COLORS.slate}; background-clip: content-box; }

        /* ================= molas e toques ================= */
        /* iOS clássico: saída suave, sem ressalto. */
        :root { --spring: cubic-bezier(0.25, 0.1, 0.25, 1); }

        .press { transition: transform 180ms var(--spring), background 140ms ease, box-shadow 180ms ease; }
        .press:active { opacity: 0.6; }

        /* Cartões levantam-se ligeiramente ao passar o rato. */
        .liftable { transition: background 180ms ease; }
        .liftable:hover { background: ${COLORS.paperSunken}; }

        /* Pastilha do separador ativo, com mola ao mudar. */
        .pill { transition: background 200ms var(--ease), color 160ms ease, transform 220ms var(--spring); }
        .pill:active { opacity: 0.75; }

        /* ================= entrada escalonada ================= */
        /* Os blocos de cada página entram em cascata, com poucos milissegundos
           de diferença. Dá a sensação de fluidez sem atrasar a leitura. */
        @keyframes riseIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        .pageIn > * { animation: riseIn 300ms var(--ease) both; }
        .pageIn > *:nth-child(1) { animation-delay: 0ms; }
        .pageIn > *:nth-child(2) { animation-delay: 45ms; }
        .pageIn > *:nth-child(3) { animation-delay: 90ms; }
        .pageIn > *:nth-child(4) { animation-delay: 130ms; }
        .pageIn > *:nth-child(5) { animation-delay: 165ms; }
        .pageIn > *:nth-child(n+6) { animation-delay: 195ms; }

        /* ================= esqueletos e notificações ================= */
        @keyframes shimmer { from { background-position: -200% 0; } to { background-position: 200% 0; } }
        .shimmer {
          background: linear-gradient(90deg, ${COLORS.ruleSoft} 25%, ${COLORS.rule} 37%, ${COLORS.ruleSoft} 63%);
          background-size: 200% 100%;
          animation: shimmer 1.4s ease-in-out infinite;
        }
        @keyframes toastIn { from { opacity: 0; transform: translateY(14px) scale(0.97); } to { opacity: 1; transform: none; } }
        .toastIn { animation: toastIn 300ms var(--ease) both; }

        /* ================= foco acessível ================= */
        :focus-visible {
          outline: none;
          box-shadow: 0 0 0 2px ${COLORS.paper}, 0 0 0 4px ${COLORS.navy}55;
          border-radius: 8px;
        }

        /* ================= respeito pelas preferências ================= */
        @media (prefers-reduced-motion: reduce) {
          .press, .liftable, .pill { transition: none; }
          .press:active, .pill:active { opacity: 1; }
          .pageIn > * { animation: none; }
          .shimmer { animation: none; }
          .toastIn { animation: none; }
        }
        /* Quem pede mais contraste não deve ficar com chrome translúcido. */
      `}</style>

      {/* ---------- barra lateral ---------- */}
      <div
        style={{
          width: 248,
          flex: "none",
          background: COLORS.sideBg,
          borderRight: `1px solid ${COLORS.rule}`,
          display: "flex",
          flexDirection: "column",
          position: "sticky",
          top: 0,
          height: "100vh",
          padding: "14px 0",
          zIndex: 6,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 16px 16px" }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: COLORS.navy,
              display: "grid",
              placeItems: "center",
              flex: "none",
              overflow: "hidden",
            }}
          >
            <img src={LOGO_BRANCO} alt="Dragon Force" style={{ height: 24, width: "auto" }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, letterSpacing: "-0.01em", lineHeight: 1.25 }}>Qualidade</div>
            <div style={{ fontSize: 11.5, color: COLORS.slate }}>Dragon Force</div>
          </div>
        </div>

        {secoes.map((sec) => (
          <div key={sec.grupo}>
            <div style={{ padding: "12px 16px 5px", fontSize: 11, fontWeight: 600, color: COLORS.slate }}>{sec.grupo}</div>
            {sec.itens.map(({ key, label, icon: Icon, contador }) => {
              const ativo = page === key;
              return (
                <button
                  key={key}
                  className="navItem press"
                  onClick={() => setPage(key)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 9,
                    width: "calc(100% - 16px)",
                    margin: "1px 8px",
                    padding: "8px 9px",
                    borderRadius: 7,
                    border: "none",
                    background: ativo ? COLORS.navyWash : "transparent",
                    color: ativo ? COLORS.navySoft : COLORS.ink2,
                    fontWeight: ativo ? 600 : 450,
                    fontSize: 13.5,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <Icon size={15} />
                  <span style={{ flex: 1 }}>{label}</span>
                  {contador ? (
                    <span style={{ fontSize: 11.5, fontWeight: 500, color: ativo ? COLORS.navySoft : COLORS.slate }}>{contador}</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ))}

        <div style={{ padding: "12px 16px 5px", fontSize: 11, fontWeight: 600, color: COLORS.slate }}>Configuração</div>
        <button
          className="navItem press"
          onClick={() => setListaAberta("__indice")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 9,
            width: "calc(100% - 16px)",
            margin: "1px 8px",
            padding: "8px 9px",
            borderRadius: 7,
            border: "none",
            background: "transparent",
            color: COLORS.ink2,
            fontWeight: 450,
            fontSize: 13.5,
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <ShieldAlert size={15} />
          <span>Listas</span>
        </button>

        {/* alternador de tema */}
        <div style={{ marginTop: "auto", padding: "12px 16px 0", borderTop: `1px solid ${COLORS.rule}` }}>
          <div style={{ display: "flex", background: COLORS.segTrack, borderRadius: 9, padding: 2, gap: 2 }}>
            {[
              ["light", "Claro"],
              ["dark", "Escuro"],
            ].map(([t, l]) => (
              <button
                key={t}
                className="press"
                onClick={() => setTema(t)}
                style={{
                  flex: 1,
                  background: tema === t ? COLORS.paperRaised : "transparent",
                  border: "none",
                  borderRadius: 7,
                  padding: "5px 4px",
                  fontSize: 11.5,
                  fontWeight: tema === t ? 600 : 500,
                  color: tema === t ? COLORS.ink : COLORS.ink2,
                  cursor: "pointer",
                  boxShadow: tema === t ? "0 1px 3px rgba(0,0,0,0.12)" : "none",
                }}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ---------- conteúdo ---------- */}
      <div style={{ flex: 1, minWidth: 0, maxWidth: "100%", overflowX: "hidden", display: "flex", flexDirection: "column" }}>
        <div
          style={{
            height: 52,
            background: COLORS.paperRaised,
            borderBottom: `1px solid ${COLORS.rule}`,
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "0 22px",
            position: "sticky",
            top: 0,
            zIndex: 5,
          }}
        >
          <div style={{ fontSize: 13.5, color: COLORS.slate }}>
            Gestão · <strong style={{ color: COLORS.ink, fontWeight: 600 }}>{titulo}</strong>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
            <button
              className="press"
              onClick={() => setPaletaAberta(true)}
              title="Procurar (⌘K)"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: COLORS.paperSunken,
                border: `1px solid ${COLORS.rule}`,
                borderRadius: 8,
                padding: "6px 10px",
                fontSize: 12.5,
                color: COLORS.slate,
                cursor: "pointer",
              }}
            >
              <Search size={14} />
              <span>Procurar</span>
              <span style={{ display: "flex", gap: 3 }}>
                <kbd style={{ fontFamily: "inherit", fontSize: 11, fontWeight: 600, background: COLORS.paperRaised, border: `1px solid ${COLORS.rule}`, borderRadius: 4, padding: "1px 5px" }}>⌘</kbd>
                <kbd style={{ fontFamily: "inherit", fontSize: 11, fontWeight: 600, background: COLORS.paperRaised, border: `1px solid ${COLORS.rule}`, borderRadius: 4, padding: "1px 5px" }}>K</kbd>
              </span>
            </button>
            {page === "registo" && reclamacoesView === "registo" && (
              <button
                className="press"
                onClick={() => {
                  setEditing(null);
                  setShowForm(true);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  background: COLORS.navy,
                  color: COLORS.onAccent,
                  border: "none",
                  borderRadius: 8,
                  padding: "8px 14px",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                <Plus size={15} /> Nova reclamação
              </button>
            )}
          </div>
        </div>

      <div key={page} className="pageIn" style={{ padding: "20px 22px 56px", maxWidth: 1360, minWidth: 0 }}>
        {page === "auditorias" ? (
          <AuditsPage
            audits={audits}
            onNewAudit={() => setShowAuditForm(true)}
            onOpenAudit={(a) => setViewingAudit(a)}
            schoolOptions={options.schools}
            areaOptions={options.auditAreas}
            auditCategoryOptions={options.auditCategories}
          />
        ) : page === "inscritos" ? (
          <InscritosPage
            inscritos={inscritos}
            turmasAlunos={turmasAlunos}
            epocaAnterior={epocaAnterior}
            options={options}
            desistencias={desistencias}
            experiencias={experiencias}
            desvinculacoes={desvinculacoes}
            espacos={espacos}
            eventos={eventos}
            satisfacao={satisfacao}
            onSaveDesistencia={saveDesistencia}
            onRemoveDesistencia={removeDesistencia}
            onSaveExperiencia={saveExperiencia}
            onUpdateExperiencia={updateExperiencia}
            onRemoveExperiencia={removeExperiencia}
            onSaveDesvinc={saveDesvinc}
            onUpdateDesvinc={updateDesvinc}
            onRemoveDesvinc={removeDesvinc}
            onSaveEspaco={saveEspaco}
            onRemoveEspaco={removeEspaco}
            onSaveEvento={saveEvento}
            onRemoveEvento={removeEvento}
            onSaveSatisfacao={saveSatisfacao}
            onRemoveSatisfacao={removeSatisfacao}
            onGerirLista={setListaAberta}
            onSaveSemana={saveSemanaInscritos}
            onRetrato={guardarRetrato}
            onImportarTurmas={importarTurmas}
            notificar={notificar}
            onSaveTurma={saveTurmaAlunos}
            onRemoveTurma={removeTurmaAlunos}
            onSaveEpocaAnterior={saveEpocaAnterior}
            onToggleTurmaEscola={toggleTurmaEscola}
            onAddOption={addOption}
            onRemoveOption={removeOption}
          />
        ) : page === "sancoes" ? (
          <SanctionsPage
            sanctions={sanctions}
            onNew={() => setShowSanctionForm(true)}
            onOpen={(s) => setViewingSanction(s)}
          />
        ) : (
        <>
        <div
          style={{
            display: "inline-flex",
            gap: 3,
            padding: 3,
            marginBottom: 20,
            background: COLORS.segTrack,
            border: "none",
            borderRadius: 9,
          }}
        >
          {[
            { key: "registo", label: "Registo", icon: LayoutGrid },
            { key: "analise", label: "Análise", icon: BarChart3 },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              className="pill"
              onClick={() => setReclamacoesView(key)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                padding: "8px 14px",
                border: "none",
                borderRadius: 7,
                background: reclamacoesView === key ? COLORS.paperRaised : "transparent",
                color: reclamacoesView === key ? COLORS.ink : COLORS.ink2,
                fontWeight: reclamacoesView === key ? 600 : 500,
                fontSize: 13,
                cursor: "pointer",
                boxShadow: reclamacoesView === key ? "0 1px 3px rgba(0,0,0,0.12)" : "none",
              }}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        {reclamacoesView === "analise" ? (
          <AnalysisDashboard withStatus={withStatus} schoolOptions={options.schools} categoryOptions={options.categories} categoriaOptions={options.complaintCategories} />
        ) : (
        <>
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "flex-start",
            background: COLORS.warnBg,
            border: `1px solid ${COLORS.warn}`,
            borderRadius: 5,
            padding: "12px 14px",
            marginBottom: 22,
            fontSize: 13,
            color: "#5c4409",
          }}
        >
          <ShieldAlert size={18} color={COLORS.warn} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            Estes dados são partilhados por qualquer pessoa com acesso a este artefacto — não têm autenticação real.
            Não é adequado para dados sensíveis de reclamantes a longo prazo; usa isto como protótipo de trabalho,
            e mantém o link apenas dentro da equipa.
          </div>
        </div>

        <div style={{ display: "flex", gap: 14, marginBottom: 24, flexWrap: "wrap" }}>
          <StatCard label="Por iniciar" value={stats.porPegar} color={COLORS.warn} />
          <StatCard label="Em andamento" value={stats.emAndamento} color={COLORS.progress} />
          <StatCard label="Atrasadas" value={stats.atrasadas} color={COLORS.danger} />
          <StatCard label="Concluídas" value={stats.concluidas} color={COLORS.ok} />
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ position: "relative", flex: "1 1 220px" }}>
            <Search size={15} style={{ position: "absolute", left: 10, top: 10, color: COLORS.slate }} />
            <input
              placeholder="Pesquisar reclamante ou descrição..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ ...inputStyle, paddingLeft: 32 }}
            />
          </div>
          <select value={filterEpoca} onChange={(e) => setFilterEpoca(e.target.value)} style={{ ...inputStyle, width: 150 }}>
            <option value="todas">Todas as épocas</option>
            {[...new Set(entries.map((e) => e.epoca).filter(Boolean))].sort().reverse().map((ep) => (
              <option key={ep} value={ep}>
                {ep}
              </option>
            ))}
          </select>
          <select value={filterCanal} onChange={(e) => setFilterCanal(e.target.value)} style={{ ...inputStyle, width: 190 }}>
            <option value="todos">Todos os canais</option>
            {Object.entries(CANAL_META).map(([key, meta]) => (
              <option key={key} value={key}>
                {meta.label}
              </option>
            ))}
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ ...inputStyle, width: 190 }}>
            <option value="todos">Todos os estados</option>
            <option value="por_pegar">Por iniciar</option>
            <option value="em_andamento">Em andamento</option>
            <option value="atrasado">Atrasado</option>
            <option value="concluido">Concluído</option>
          </select>
        </div>

        {loading ? (
          <EsqueletoPagina />
        ) : filtered.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "50px 20px",
              color: COLORS.slate,
              border: `1.5px dashed ${COLORS.rule}`,
              borderRadius: 6,
            }}
          >
            Sem reclamações a mostrar. Cria a primeira entrada com "Nova reclamação".
          </div>
        ) : (
          <div style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.rule}`, borderRadius: 6, overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5, minWidth: 880 }}>
              <thead>
                <tr style={{ background: COLORS.paperSunken, textAlign: "left" }}>
                  {["Nº", "Receção", "Época", "Canal", "Gravidade", "Categoria", "Escola", "Tema", "Reclamante", "Prazo", "Estado", ""].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "10px 14px",
                        fontSize: 11,
                        letterSpacing: "0.05em",
                        textTransform: "uppercase",
                        color: COLORS.slate,
                        fontWeight: 600,
                        borderBottom: `1.5px solid ${COLORS.rule}`,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.id} style={{ borderBottom: `1px solid ${COLORS.rule}` }}>
                    <td style={{ padding: "10px 14px", fontVariantNumeric: "tabular-nums", color: COLORS.slate }}>
                      {String(e.entryNumber).padStart(4, "0")}
                    </td>
                    <td style={{ padding: "10px 14px" }}>{fmt(new Date(e.receivedDate + "T00:00:00"))}</td>
                    <td style={{ padding: "10px 14px", fontVariantNumeric: "tabular-nums", color: COLORS.slate }}>{e.epoca || "—"}</td>
                    <td style={{ padding: "10px 14px" }}>
                      {e.canal && CANAL_META[e.canal] && <Tag label={CANAL_META[e.canal].label} color={CANAL_META[e.canal].color} bg={CANAL_META[e.canal].bg} />}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      {e.severity && <Tag label={SEVERITY_META[e.severity].label} color={SEVERITY_META[e.severity].color} bg={SEVERITY_META[e.severity].bg} />}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      {e.categoria && <Tag label={e.categoria} color={colorForLabel(e.categoria).color} bg={colorForLabel(e.categoria).bg} />}
                    </td>
                    <td style={{ padding: "10px 14px", color: COLORS.slate }}>{e.school || "—"}</td>
                    <td style={{ padding: "10px 14px", color: COLORS.slate }}>{e.tema || "—"}</td>
                    <td style={{ padding: "10px 14px", fontWeight: 600 }}>{e.complainant}</td>
                    <td style={{ padding: "10px 14px", fontVariantNumeric: "tabular-nums" }}>{fmt(new Date(e.deadline))}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <Stamp statusKey={e.derivedStatus} onClick={() => setViewingDetail(e)} />
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        {e.status === "por_pegar" && (
                          <button title="Iniciar" onClick={() => startWork(e.id)} style={iconBtnStyle}>
                            <Play size={16} color={COLORS.progress} />
                          </button>
                        )}
                        {e.derivedStatus === "concluido" ? (
                          <button title="Reabrir" onClick={() => reopen(e.id)} style={iconBtnStyle}>
                            <Clock size={16} />
                          </button>
                        ) : (
                          <button title="Marcar concluído" onClick={() => setViewingDetail(e)} style={iconBtnStyle}>
                            <Check size={16} color={COLORS.ok} />
                          </button>
                        )}
                        <button
                          title="Editar"
                          onClick={() => {
                            setEditing(e);
                            setShowForm(true);
                          }}
                          style={iconBtnStyle}
                        >
                          <Pencil size={16} />
                        </button>
                        <button title="Eliminar" onClick={() => remove(e.id)} style={iconBtnStyle}>
                          <Trash2 size={16} color={COLORS.danger} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        </>
        )}
        </>
        )}
        </div>
      </div>

      {showForm && (
        <EntryForm
          initial={editing}
          nextNumber={nextNumber}
          schoolOptions={options.schools}
          categoryOptions={options.categories}
          categoriaOptions={options.complaintCategories}
          onGerirLista={setListaAberta}
          learned={learned}
          onCancel={() => {
            setShowForm(false);
            setEditing(null);
          }}
          onSave={handleSave}
        />
      )}


      {viewingDetail && (
        <ComplaintDetail
          entry={withStatus.find((e) => e.id === viewingDetail.id) || viewingDetail}
          onClose={() => setViewingDetail(null)}
          onAddNote={addNote}
          onStart={(id) => {
            startWork(id);
            setViewingDetail(null);
          }}
          onDone={(id, extra, keepOpen) => {
            markDone(id, extra);
            if (!keepOpen) setViewingDetail(null);
          }}
          onReopen={(id) => {
            reopen(id);
            setViewingDetail(null);
          }}
        />
      )}

      {showAuditForm && (
        <AuditForm
          schoolOptions={options.schools}
          onCancel={() => setShowAuditForm(false)}
          onSave={addAudit}
          onGerirLista={setListaAberta}
        />
      )}

      {viewingAudit && (
        <AuditDetail
          audit={audits.find((a) => a.id === viewingAudit.id) || viewingAudit}
          auditCategoryOptions={options.auditCategories}
          areaOptions={options.auditAreas}
          onClose={() => setViewingAudit(null)}
          onAddFinding={addFinding}
          onRemoveFinding={removeFinding}
          onUpdateFinding={updateFinding}
          onRemoveAudit={removeAudit}
          onGerirLista={setListaAberta}
        />
      )}

      {listaAberta === "__indice" && (
        <div
          className="veil"
          style={{ position: "fixed", inset: 0, background: "rgba(8,14,24,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 70, padding: 16 }}
          onClick={() => setListaAberta(null)}
        >
          <div
            className="sheet"
            style={{
              width: "min(520px, 100%)",
              maxHeight: "calc(100vh - 32px)",
              overflowY: "auto",
              background: COLORS.paperRaised,
              border: `1px solid ${COLORS.rule}`,
              borderRadius: 14,
              padding: "20px 22px 22px",
              boxShadow: "0 20px 50px -12px rgba(8,14,24,0.35)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 4 }}>
              <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.015em" }}>Listas da app</div>
              <button onClick={() => setListaAberta(null)} style={{ ...iconBtnStyle, padding: 0 }} aria-label="Fechar">
                <X size={17} />
              </button>
            </div>
            <div style={{ fontSize: 12.5, color: COLORS.ink2, marginBottom: 16, lineHeight: 1.5 }}>
              Também podes gerir cada lista onde ela é usada, no link "Gerir" junto ao campo.
            </div>
            <div style={{ border: `1px solid ${COLORS.rule}`, borderRadius: 10, overflow: "hidden" }}>
              {Object.entries(LISTAS).map(([chave, meta], i) => (
                <button
                  key={chave}
                  onClick={() => setListaAberta(chave)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    width: "100%",
                    textAlign: "left",
                    border: "none",
                    borderTop: i ? `1px solid ${COLORS.ruleSoft}` : "none",
                    background: "transparent",
                    padding: "11px 13px",
                    cursor: "pointer",
                    color: COLORS.ink,
                    fontSize: 13.5,
                  }}
                  className="liftable"
                >
                  <span style={{ flex: 1, fontWeight: 500 }}>{meta.titulo}</span>
                  <span style={{ fontSize: 11.5, color: COLORS.slate, fontVariantNumeric: "tabular-nums" }}>
                    {(options[chave] || []).length} item(s)
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {listaAberta && listaAberta !== "__indice" && LISTAS[listaAberta] && (
        <GestorLista
          titulo={LISTAS[listaAberta].titulo}
          nota={LISTAS[listaAberta].nota}
          placeholder={LISTAS[listaAberta].placeholder}
          itens={options[listaAberta] || []}
          emUso={LISTAS[listaAberta].emUso}
          onAdd={(v) => addOption(listaAberta, v)}
          onRemove={(v) => removeOption(listaAberta, v)}
          onClose={() => setListaAberta(null)}
        />
      )}

      <PaletaComandos aberta={paletaAberta} onFechar={() => setPaletaAberta(false)} comandos={comandosPaleta} />

      <Notificacoes lista={notificacoes} onFechar={fecharNotificacao} />

      {showSanctionForm && (
        <SanctionForm
          onCancel={() => setShowSanctionForm(false)}
          onSave={saveSanction}
          schoolOptions={options.schools}
          complaints={entries}
          sanctionTypes={options.sanctionTypes}
          onGerirLista={setListaAberta}
        />
      )}

      {viewingSanction && (
        <SanctionDetail
          sanction={sanctions.find((s) => s.id === viewingSanction.id) || viewingSanction}
          onClose={() => setViewingSanction(null)}
          onUpdate={updateSanction}
          onAddNote={addSanctionNote}
          onRemove={removeSanction}
          complaints={entries}
          sanctionTypes={options.sanctionTypes}
        />
      )}
    </div>
  );
}
