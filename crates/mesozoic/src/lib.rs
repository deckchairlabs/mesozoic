use deno_ast::EmitOptions;
use deno_ast::parse_module;
use deno_ast::MediaType;
use deno_ast::ParseParams;
use deno_ast::SourceTextInfo;
use deno_ast::swc::parser::TsConfig;
use wasm_bindgen::prelude::wasm_bindgen;

#[wasm_bindgen]
pub async fn transform(source_text: String) -> String {
  let text_info = SourceTextInfo::from_string(source_text);
  let parsed_source = parse_module(ParseParams {
    specifier: "file:///my_file.ts".to_string(),
    media_type: MediaType::TypeScript,
    text_info,
    capture_tokens: false,
    maybe_syntax: Some(deno_ast::swc::parser::Syntax::Typescript(TsConfig {
      tsx: true,
      ..Default::default()
    })),
    scope_analysis: false,
  }).expect("should parse");

  let transpiled_source = parsed_source.transpile(&EmitOptions {
    jsx_automatic: true,
    jsx_development: false,
    inline_source_map: false,
    jsx_import_source: Some("react".into()),
    ..Default::default()
  }).expect("should transpile");
  
  transpiled_source.text.into()
}