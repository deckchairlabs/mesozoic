use deno_ast::fold_program;
use deno_ast::parse_module;
use deno_ast::swc::codegen::text_writer::JsWriter;
use deno_ast::swc::common::FileName;
use deno_ast::swc::common::Globals;
use deno_ast::swc::common::Mark;
use deno_ast::swc::common::SourceMap;
use deno_ast::swc::parser::TsConfig;
use deno_ast::EmitOptions;
use deno_ast::MediaType;
use deno_ast::ParseParams;
use deno_ast::SourceTextInfo;
use std::rc::Rc;
use wasm_bindgen::prelude::*;
use wasm_bindgen::JsValue;

pub fn transform_source(
    specifier: String,
    source_text: String,
    maybe_jsx_import_source: Option<String>,
    development: bool,
    minify: bool,
) -> Result<String, anyhow::Error> {
    let text_info = SourceTextInfo::from_string(source_text);
    let media_type = MediaType::from(&specifier);

    let parse_result = parse_module(ParseParams {
        specifier,
        media_type,
        text_info,
        capture_tokens: true,
        maybe_syntax: Some(deno_ast::swc::parser::Syntax::Typescript(TsConfig {
            tsx: true,
            decorators: false,
            dts: false,
            no_early_errors: false,
        })),
        scope_analysis: false,
    });

    match parse_result {
        Ok(parsed_source) => {
            let program = (*parsed_source.program()).clone();
            let source_map = Rc::new(SourceMap::default());

            let file_name = FileName::Custom(parsed_source.specifier().to_string());
            source_map.new_source_file(file_name, parsed_source.text_info().text().to_string());

            // needs to align with what's done internally in source map
            assert_eq!(1, parsed_source.text_info().range().start.as_byte_pos().0);

            // we need the comments to be mutable, so make it single threaded
            let comments = parsed_source.comments().as_single_threaded();
            let globals = Globals::new();

            let emit_options = EmitOptions {
                jsx_automatic: true,
                inline_source_map: false,
                jsx_development: development,
                jsx_import_source: maybe_jsx_import_source,
                ..Default::default()
            };

            let transpiled_result = deno_ast::swc::common::GLOBALS.set(&globals, || {
                let top_level_mark = Mark::fresh(Mark::root());
                let program = fold_program(
                    program,
                    &emit_options,
                    source_map.clone(),
                    &comments,
                    top_level_mark,
                    parsed_source.diagnostics(),
                )
                .unwrap_or_else(|error| panic!("fold program: {error}"));

                let mut buf = vec![];
                let writer = Box::new(JsWriter::new(source_map.clone(), "\n", &mut buf, None));

                let config = deno_ast::swc::codegen::Config {
                    minify,
                    ascii_only: false,
                    omit_last_semi: false,
                    target: deno_ast::swc::ast::EsVersion::Es2022,
                };

                let mut emitter = deno_ast::swc::codegen::Emitter {
                    cfg: config,
                    comments: Some(&comments),
                    cm: source_map.clone(),
                    wr: writer,
                };

                emitter
                    .emit_program(&program)
                    .unwrap_or_else(|error| panic!("emit program: {error}"));

                String::from_utf8(buf)
            });

            match transpiled_result {
                Ok(transpiled) => Ok(transpiled),
                Err(error) => Err(error.into()),
            }
        }
        Err(error) => Err(error.into()),
    }
}

#[wasm_bindgen]
pub fn transform(
    specifier: String,
    source_text: String,
    maybe_jsx_import_source: Option<String>,
    development: bool,
    minify: bool,
) -> Result<String, JsValue> {
    let transformed = transform_source(
        specifier,
        source_text,
        maybe_jsx_import_source,
        development,
        minify,
    );

    match transformed {
        Ok(transformed) => Ok(transformed),
        Err(error) => Err(JsValue::from(js_sys::Error::new(&error.to_string()))),
    }
}

#[cfg(test)]
mod tests {
    use crate::transform_source;

    fn transform_test(
        specifier: String,
        source_text: String,
        development: bool,
    ) -> Result<String, anyhow::Error> {
        transform_source(
            specifier,
            source_text,
            Some("react".into()),
            development,
            !development,
        )
    }

    #[test]
    fn it_can_transform_jsx() {
        let specifier: String = "test.jsx".into();
        let source_text: String = r#"
        export default function App() {
            return <div>Hello</div>;
        }
        "#
        .into();

        let result = transform_test(specifier, source_text, false);
        assert!(result.is_ok());
    }

    #[test]
    fn it_can_transform_tsx() {
        let specifier: String = "test.tsx".into();
        let source_text: String = r#"
        import { PropsWithChildren } from 'react';
    
        export default function App({ children }: PropsWithChildren) {
          return <div>{children}</div>;
        }
    
        const result = () => <App><div>Hello</div></App>;
        "#
        .into();

        let result = transform_test(specifier, source_text, false);
        assert!(result.is_ok());
    }

    #[test]
    fn it_can_handle_failures() {
        let specifier: String = "test.tsx".into();
        let source_text: String = r#"
        import { PropsWithChildren } from 'react';
    
        export default function App({ children }: PropsWithChildren) {
          return <div>{children};
        }
    
        const result = () => <App><div>Hello</div></App>;
        "#
        .into();

        let result = transform_test(specifier, source_text, false);
        assert!(result.is_err());
    }
}
