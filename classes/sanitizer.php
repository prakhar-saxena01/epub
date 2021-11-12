<?php
class Sanitizer {

	public static function rewrite_relative(string $url, string $rel_url) : string {

		$rel_parts = parse_url($rel_url);

		if (!empty($rel_parts['host']) && !empty($rel_parts['scheme'])) {
			return self::validate($rel_url);
		} else if (strpos($rel_url, "//") === 0) {
			# protocol-relative URL (rare but they exist)
			return self::validate("https:" . $rel_url);
		} else if (strpos($rel_url, "magnet:") === 0) {
			# allow magnet links
			return $rel_url;
		} else {
			$parts = parse_url($url);

			$rel_parts['host'] = $parts['host'];
			$rel_parts['scheme'] = $parts['scheme'];

			/** @phpstan-ignore-next-line */
			if (isset($rel_parts['path'])) {
				if (strpos($rel_parts['path'], '/') !== 0)
					$rel_parts['path'] = '/' . $rel_parts['path'];

				$rel_parts['path'] = str_replace("/./", "/", $rel_parts['path']);
				$rel_parts['path'] = str_replace("//", "/", $rel_parts['path']);
			}

			return self::validate(self::build_url($rel_parts));
		}
	}

	public static function sanitize(string $str) : string {

		$res = trim($str); if (!$res) return '';

		$doc = new DOMDocument();
		$doc->loadHTML('<?xml encoding="UTF-8">' . $res);
		$xpath = new DOMXPath($doc);

		// is it a good idea to possibly rewrite urls to our own prefix?
		// $rewrite_base_url = $site_url ? $site_url : Config::get_self_url();
		$rewrite_base_url = "http://domain.invalid/";

		$entries = $xpath->query('(//a[@href]|//img[@src]|//source[@srcset|@src])');

		foreach ($entries as $entry) {

			if ($entry->hasAttribute('href')) {
				$entry->setAttribute('href',
					self::rewrite_relative($rewrite_base_url, $entry->getAttribute('href')));

				$entry->setAttribute('rel', 'noopener noreferrer');
				$entry->setAttribute("target", "_blank");
			}

			if ($entry->hasAttribute('src')) {
				$entry->setAttribute('src',
					self::rewrite_relative($rewrite_base_url, $entry->getAttribute('src')));
			}

			if ($entry->nodeName == 'img') {
				$entry->setAttribute('referrerpolicy', 'no-referrer');
				$entry->setAttribute('loading', 'lazy');
			}

			if ($entry->hasAttribute('srcset')) {
				$entry->removeAttribute('srcset');
			}
		}

		$allowed_elements = array('a', 'abbr', 'address', 'acronym', 'audio', 'article', 'aside',
			'b', 'bdi', 'bdo', 'big', 'blockquote', 'body', 'br',
			'caption', 'cite', 'center', 'code', 'col', 'colgroup',
			'data', 'dd', 'del', 'details', 'description', 'dfn', 'div', 'dl', 'font',
			'dt', 'em', 'footer', 'figure', 'figcaption',
			'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr', 'html', 'i',
			'img', 'ins', 'kbd', 'li', 'main', 'mark', 'nav', 'noscript',
			'ol', 'p', 'picture', 'pre', 'q', 'ruby', 'rp', 'rt', 's', 'samp', 'section',
			'small', 'source', 'span', 'strike', 'strong', 'sub', 'summary',
			'sup', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'time',
			'tr', 'track', 'tt', 'u', 'ul', 'var', 'wbr', 'video', 'xml:namespace' );

		$disallowed_attributes = array('id', 'style', 'class', 'width', 'height', 'allow');

		$doc->removeChild($doc->firstChild); //remove doctype
		$doc = self::strip_harmful_tags($doc, $allowed_elements, $disallowed_attributes);

		$res = $doc->saveHTML();

		/* strip everything outside of <body>...</body> */

		$res_frag = array();
		if (preg_match('/<body>(.*)<\/body>/is', $res, $res_frag)) {
			return $res_frag[1];
		} else {
			return $res;
		}
	}

	/**
	 * 	@param array<string> $allowed_elements
	 * 	@param array<string> $disallowed_attributes
	 * */
	private static function strip_harmful_tags(DOMDocument $doc, array $allowed_elements, array $disallowed_attributes) : DOMDocument {
		$xpath = new DOMXPath($doc);
		$entries = $xpath->query('//*');

		foreach ($entries as $entry) {
			if (!in_array($entry->nodeName, $allowed_elements)) {
				$entry->parentNode->removeChild($entry);
			}

			if ($entry->hasAttributes()) {
				$attrs_to_remove = array();

				foreach ($entry->attributes as $attr) {

					if (strpos($attr->nodeName, 'on') === 0) {
						array_push($attrs_to_remove, $attr);
					}

					if (strpos($attr->nodeName, "data-") === 0) {
						array_push($attrs_to_remove, $attr);
					}

					if ($attr->nodeName == 'href' && stripos($attr->value, 'javascript:') === 0) {
						array_push($attrs_to_remove, $attr);
					}

					if (in_array($attr->nodeName, $disallowed_attributes)) {
						array_push($attrs_to_remove, $attr);
					}
				}

				foreach ($attrs_to_remove as $attr) {
					$entry->removeAttributeNode($attr);
				}
			}
		}

		return $doc;
	}

	// extended filtering involves validation for safe ports and loopback
	/** @return string|bool */
	static function validate(string $url, bool $extended_filtering = false) : mixed {

		$url = trim($url);

		# fix protocol-relative URLs
		if (strpos($url, "//") === 0)
			$url = "https:" . $url;

		$tokens = parse_url($url);

		// this isn't really necessary because filter_var(... FILTER_VALIDATE_URL) requires host and scheme
		// as per https://php.watch/versions/7.3/filter-var-flag-deprecation but it might save time
		if (empty($tokens['host']))
			return false;

		if (!in_array(strtolower($tokens['scheme']), ['http', 'https']))
			return false;

		//convert IDNA hostname to punycode if possible
		if (function_exists("idn_to_ascii")) {
			if (mb_detect_encoding($tokens['host']) != 'ASCII') {
				if (defined('IDNA_NONTRANSITIONAL_TO_ASCII') && defined('INTL_IDNA_VARIANT_UTS46')) {
					$tokens['host'] = idn_to_ascii($tokens['host'], IDNA_NONTRANSITIONAL_TO_ASCII, INTL_IDNA_VARIANT_UTS46);
				} else {
					$tokens['host'] = idn_to_ascii($tokens['host']);
				}
			}
		}

		// separate set of tokens with urlencoded 'path' because filter_var() rightfully fails on non-latin characters
		// (used for validation only, we actually request the original URL, in case of urlencode breaking it)
		$tokens_filter_var = $tokens;

		if ($tokens['path'] ?? false) {
			$tokens_filter_var['path'] = implode("/",
										array_map("rawurlencode",
											array_map("rawurldecode",
												explode("/", $tokens['path']))));
		}

		$url = self::build_url($tokens);
		$url_filter_var = self::build_url($tokens_filter_var);

		if (filter_var($url_filter_var, FILTER_VALIDATE_URL) === false)
			return false;

		if ($extended_filtering) {
			if (!in_array($tokens['port'] ?? '', [80, 443, '']))
				return false;

			if (strtolower($tokens['host']) == 'localhost' || $tokens['host'] == '::1' || strpos($tokens['host'], '127.') === 0)
				return false;
		}

		return $url;
	}

	/** @param array<string, int|string|false> $parts */
	static function build_url(array $parts) : string {
		$tmp = $parts['scheme'] . "://" . $parts['host'];

		if (isset($parts['path'])) $tmp .= $parts['path'];
		if (isset($parts['query'])) $tmp .= '?' . $parts['query'];
		if (isset($parts['fragment'])) $tmp .= '#' . $parts['fragment'];

		return $tmp;
	}

	/** @return string|bool */
	static function resolve_redirects(string $url, int $timeout, int $nest = 0) : mixed {

		// too many redirects
		if ($nest > 10)
			return false;

		if (version_compare(PHP_VERSION, '7.1.0', '>=')) {
			$context_options = array(
				'http' => array(
					'header' => array(
						'Connection: close'
					),
					'method' => 'HEAD',
					'timeout' => $timeout,
					'protocol_version'=> 1.1)
				);

			$context = stream_context_create($context_options);

			$headers = get_headers($url, 0, $context);
		} else {
			$headers = get_headers($url, 0);
		}

		if (is_array($headers)) {
			$headers = array_reverse($headers); // last one is the correct one

			foreach($headers as $header) {
				if (stripos($header, 'Location:') === 0) {
					$url = self::rewrite_relative($url, trim(substr($header, strlen('Location:'))));

					return self::resolve_redirects($url, $timeout, $nest + 1);
				}
			}

			return $url;
		}

		// request failed?
		return false;
	}

}
