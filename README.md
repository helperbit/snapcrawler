rtindex e' il servizio che prende uno snapshot, oppure lo renderizza salvandolo e lo restituisce
index invece crea tutti gli snapshot del sito e le sitemap

## Install

```
npm install
bash install.sh
servicectl start helperbit-snapcrawler
servicectl enable helperbit-snapcrawler
```


## Nginx conf

```
       location @prerender {        


        set $prerender 0;
        if ($http_user_agent ~* "twitterbot|facebookexternalhit|rogerbot|linkedinbot|embedly|quora link preview|showyoubot|outbrain|pinterest|slackbot|vkShare|W3C_Validator") {
            set $prerender 1;
        }
	if ($http_user_agent ~* "googlebot|bingbot|yandex|baiduspider") {
	    set $prerender 1;
	}
        if ($args ~ "_escaped_fragment_") {
            set $prerender 1;
        }
        if ($http_user_agent ~ "Prerender") {
            set $prerender 0;
        }
        if ($uri ~* "\.(js|css|xml|less|png|jpg|jpeg|gif|pdf|doc|txt|ico|rss|zip|mp3|rar|exe|wmv|doc|avi|ppt|mpg|mpeg|tif|wav|mov|psd|ai|xls|mp4|m4a|swf|dat|dmg|iso|flv|m4v|torrent|ttf|woff|svg|eot)") {
            set $prerender 0;
        }
        
        #resolve using Google's DNS server to force DNS resolution and prevent caching of IPs
        resolver 8.8.8.8;
	proxy_cache_valid 200 24h;
	proxy_set_header X-Prerender-Token F9WnUy5gk5BKowNAWwq3;

        if ($prerender = 2) {
		rewrite .* /snapshots/$uri.html? break;
        }
        if ($prerender = 1) {            
		#set $prerender "service.prerender.io";
		set $prerender "127.0.0.1:3123";
		rewrite .* /$scheme://$host$request_uri? break;
		proxy_pass http://$prerender;
        }
        if ($prerender = 0) {
            rewrite .* /index.html break;
	}
	}
```