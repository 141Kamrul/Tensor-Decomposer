def pytest_addoption(parser):
    try:
        parser.addoption(
            "--headless",
            action="store_true",
            default=False,
            help="Run browser tests in headless mode",
        )
    except ValueError:
        pass
