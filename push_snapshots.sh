__='
   Helperbit: a p2p donation platform (snapcrawler)
   Copyright (C) 2016-2021  Helperbit team
   
   This program is free software: you can redistribute it and/or modify
   it under the terms of the GNU General Public License as published by
   the Free Software Foundation, either version 3 of the License, or
   (at your option) any later version.
   
   This program is distributed in the hope that it will be useful,
   but WITHOUT ANY WARRANTY; without even the implied warranty of
   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
   GNU General Public License for more details.
   
   You should have received a copy of the GNU General Public License
   along with this program.  If not, see <https://www.gnu.org/licenses/>
'

# cp ./snapshots/sitemap.xml ../frontend/app/assets/sitemap.xml
# cp ./snapshots/sitemap_images.xml ../frontend/app/assets/sitemap_images.xml
rsync -azP ./snapshots/sitemap.xml root@:/root/mainnet/snapcrawler/snapshots/sitemap.xml
rsync -azP ./snapshots/sitemap.xml root@:/var/www/html/frontend-main/dist/sitemap.xml
rsync -azP ./snapshots/sitemap_images.xml root@:/root/mainnet/snapcrawler/snapshots/sitemap_images.xml
rsync -azP ./snapshots/sitemap_images.xml root@:/var/www/html/frontend-main/dist/sitemap_images.xml
