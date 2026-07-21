from PIL import Image
img = Image.open('../web/public/logo.png').convert('RGB')
colors = img.getcolors(img.size[0]*img.size[1])
colors = sorted([c for c in colors if sum(c[1]) < 700], key=lambda t: t[0], reverse=True)[:5]
for count, color in colors: print(f'#{color[0]:02x}{color[1]:02x}{color[2]:02x} - Count: {count}')
