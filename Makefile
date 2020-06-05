SOURCES=drivers \
		lib \
		plugins \
		idler.js

idler.zip: $(SOURCES) node_modules
	zip -9rq $@ $(SOURCES) node_modules

node_modules: package.json
	npm install
	touch $@

clean:
	rm -rf idler.zip node_modules

.PHONY: clean
