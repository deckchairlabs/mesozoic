use deno_ast::fold_program;
use deno_ast::parse_module;
use deno_ast::swc::codegen::text_writer::JsWriter;
use deno_ast::swc::common::FileName;
use deno_ast::swc::common::Globals;
use deno_ast::swc::common::Mark;
use deno_ast::swc::common::SourceMap;
use deno_ast::EmitOptions;
use deno_ast::MediaType;
use deno_ast::ParseParams;
use deno_ast::SourceTextInfo;
use deno_ast::ES_VERSION;
use std::rc::Rc;
use wasm_bindgen::prelude::wasm_bindgen;
use wasm_bindgen::JsValue;

#[wasm_bindgen]
pub async fn transform(source_text: String) -> Result<String, JsValue> {
    let text_info = SourceTextInfo::from_string(source_text);
    let parsed_source = parse_module(ParseParams {
        specifier: "file:///my_file.ts".to_string(),
        media_type: MediaType::Tsx,
        text_info,
        capture_tokens: false,
        maybe_syntax: None,
        scope_analysis: false,
    })
    .expect("should parse");

    let program = (*parsed_source.program()).clone();
    let source_map = Rc::new(SourceMap::default());

    let file_name = FileName::Custom(parsed_source.specifier().to_string());
    source_map.new_source_file(file_name, parsed_source.text_info().text().to_string());

    // needs to align with what's done internally in source map
    assert_eq!(1, parsed_source.text_info().range().start.as_byte_pos().0);

    // we need the comments to be mutable, so make it single threaded
    let comments = parsed_source.comments().as_single_threaded();
    let globals = Globals::new();
    let options = EmitOptions {
        jsx_automatic: true,
        inline_source_map: false,
        jsx_development: false,
        jsx_import_source: Some("react".into()),
        ..Default::default()
    };

    let transpiled = deno_ast::swc::common::GLOBALS
        .set(&globals, || {
            let top_level_mark = Mark::fresh(Mark::root());
            let program = fold_program(
                program,
                &options,
                source_map.clone(),
                &comments,
                top_level_mark,
                parsed_source.diagnostics(),
            )
            .expect("fold program");

            let mut buf = vec![];

            let writer = Box::new(JsWriter::new(source_map.clone(), "\n", &mut buf, None));

            let config = deno_ast::swc::codegen::Config {
                minify: true,
                ascii_only: false,
                omit_last_semi: false,
                target: ES_VERSION,
            };

            let mut emitter = deno_ast::swc::codegen::Emitter {
                cfg: config,
                comments: Some(&comments),
                cm: source_map.clone(),
                wr: writer,
            };

            emitter.emit_program(&program).expect("failed to emit");

            String::from_utf8(buf)
        })
        .map_err(|err| JsValue::from(js_sys::Error::new(&err.to_string())))?;

    Ok(transpiled)
}
