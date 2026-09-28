from PIL import Image, ImageDraw, ImageFont, ImageOps

W, H = 1200, 630
paper = "#f4f0e7"
ink = "#171714"
terra = "#b95535"
muted = "#67645d"
img = Image.new("RGB", (W, H), paper)
d = ImageDraw.Draw(img)
serif = "/System/Library/Fonts/Supplemental/Georgia.ttf"
serif_i = "/System/Library/Fonts/Supplemental/Georgia Italic.ttf"
sans = "/System/Library/Fonts/SFNS.ttf"

portrait = Image.open("public/tugrul-guner.jpg").convert("RGB")
portrait = ImageOps.fit(portrait, (390, 470), method=Image.Resampling.LANCZOS)
portrait = ImageOps.colorize(ImageOps.grayscale(portrait), "#292724", "#ded7ca")
d.rectangle((750, 60, 1165, 555), fill="#fbf8f1", outline="#d8d1c4", width=2)
img.paste(portrait, (762, 72))

d.text((70, 60), "TUGRUL GUNER", font=ImageFont.truetype(sans, 20), fill=terra)
d.text((70, 135), "Building systems", font=ImageFont.truetype(serif, 58), fill=ink)
d.text((70, 205), "that make", font=ImageFont.truetype(serif, 58), fill=ink)
d.text((70, 275), "intelligence", font=ImageFont.truetype(serif_i, 58), fill=terra)
d.text((70, 345), "accountable.", font=ImageFont.truetype(serif_i, 58), fill=terra)
d.line((70, 455, 670, 455), fill="#d8d1c4", width=2)
d.text((70, 485), "AI ENGINEERING  ·  OPEN SOURCE  ·  MODEPOT", font=ImageFont.truetype(sans, 17), fill=muted)
d.text((70, 550), "tugrul.modepot.io", font=ImageFont.truetype(sans, 18), fill=ink)
img.save("public/social-card.png", optimize=True)
